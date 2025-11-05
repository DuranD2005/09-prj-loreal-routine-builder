/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");

/* State: cache all products and track selected product IDs */
let allProducts = [];
const selectedProductIds = new Set();

/* ---------- NEW: localStorage helpers to persist selected products ---------- */
const STORAGE_KEY = "selectedProducts";

function saveSelectedProducts() {
  try {
    const arr = Array.from(selectedProductIds);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (err) {
    // ignore storage errors for beginners
    console.error("Could not save selected products:", err);
  }
}

function loadSelectedProducts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return;
    // only keep ids that exist in allProducts (guard against stale ids)
    arr.forEach((id) => {
      const numId = Number(id);
      if (allProducts.find((p) => p.id === numId))
        selectedProductIds.add(numId);
    });
  } catch (err) {
    console.error("Could not load selected products:", err);
  }
}

/* Conversation state for follow-ups (system + user + assistant messages) */
const conversationMessages = [
  {
    role: "system",
    content:
      // Keep instructions clear for the model: only answer about the generated routine
      // or topics directly related to skincare, haircare, makeup, fragrance, and product use.
      // If the user asks anything outside those topics, refuse and ask them to rephrase.
      'You are a helpful skincare and product routine assistant. You must only answer questions about the generated routine or directly related topics (skincare, haircare, makeup, fragrance, product usage, SPF/suncare). If a user asks about anything unrelated (politics, finance, medical diagnosis beyond general skincare tips, or other off-topic subjects), reply briefly: "I can only help with the routine or product-related questions. Please ask about skincare, haircare, makeup, fragrance, or the routine."',
  },
];

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file (async/await) */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards.
   Each card includes an info button (.info-btn) that opens the modal.
   The inline description has been removed in favor of the modal.
*/
function displayProducts(products) {
  if (!products || products.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products found for this category
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProductIds.has(product.id);
      return `
      <div class="product-card ${isSelected ? "selected" : ""}" data-id="${
        product.id
      }" tabindex="0" role="button" aria-pressed="${isSelected}" aria-labelledby="prod-${
        product.id
      }-name">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3 id="prod-${product.id}-name">${product.name}</h3>
          <p>${product.brand}</p>
          <div style="margin-top:8px;">
            <!-- info button opens a modal with product details -->
            <button class="info-btn" aria-haspopup="dialog" aria-controls="productModal" data-id="${
              product.id
            }" title="Show product details">i</button>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

/* Open product modal and populate with product data */
function openProductModal(productId) {
  const product = allProducts.find((p) => p.id === productId);
  if (!product) return;
  const modal = document.getElementById("productModal");
  modal.querySelector(".modal-image").src = product.image || "";
  modal.querySelector(".modal-image").alt = product.name || "Product image";
  modal.querySelector(".modal-title").textContent = product.name || "";
  modal.querySelector(".modal-brand").textContent = product.brand || "";
  modal.querySelector(".modal-description").textContent =
    product.description || "";
  modal.setAttribute("aria-hidden", "false");
  modal.classList.add("open");
  // focus close button for accessibility
  const closeBtn = modal.querySelector(".modal-close");
  if (closeBtn) closeBtn.focus();
}

/* Close the product modal */
function closeProductModal() {
  const modal = document.getElementById("productModal");
  if (!modal) return;
  modal.setAttribute("aria-hidden", "true");
  modal.classList.remove("open");
  // return focus to the category list for context (or body)
  categoryFilter.focus();
}

/* Update the Selected Products area to reflect selectedProductIds */
function updateSelectedProductsList() {
  if (selectedProductIds.size === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected</div>`;
    return;
  }

  const chipsHtml = Array.from(selectedProductIds)
    .map((id) => {
      const product = allProducts.find((p) => p.id === id);
      if (!product) return "";
      return `
      <div class="selected-chip" data-id="${product.id}">
        <img src="${product.image}" alt="${product.name}">
        <span>${product.name}</span>
        <button class="remove-btn" aria-label="Remove ${product.name}" data-id="${product.id}">&times;</button>
      </div>
    `;
    })
    .join("");

  selectedProductsList.innerHTML = chipsHtml;
}

/* Toggle selection for a product id */
function toggleProductSelection(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
  } else {
    selectedProductIds.add(productId);
  }
  // persist selection
  saveSelectedProducts();
  // Re-render the visible grid and selected list
  // Determine currently displayed products (based on category filter)
  const currentCategory = categoryFilter.value;
  const visibleProducts = currentCategory
    ? allProducts.filter((p) => p.category === currentCategory)
    : allProducts;
  displayProducts(visibleProducts);
  updateSelectedProductsList();
}

/* Remove product from selection (used by remove button in the chips) */
function removeSelected(productId) {
  if (selectedProductIds.has(productId)) {
    selectedProductIds.delete(productId);
    // persist selection
    saveSelectedProducts();
    // Refresh UI
    const currentCategory = categoryFilter.value;
    const visibleProducts = currentCategory
      ? allProducts.filter((p) => p.category === currentCategory)
      : allProducts;
    displayProducts(visibleProducts);
    updateSelectedProductsList();
  }
}

/* Simple getter that reads the global OPENAI_API_KEY provided in a local
   `secrets.js` file which must be added to `.gitignore`.

   SECURITY: Do NOT commit real API keys. If you need a local key for a demo,
   create a `secrets.js` with:

     const OPENAI_API_KEY = 'sk-...';

   and add `secrets.js` to `.gitignore`. This repository intentionally contains
   no working API key.
*/
const DEFAULT_OPENAI_API_KEY = ""; // intentionally empty in the repo

function getApiKey() {
  if (typeof OPENAI_API_KEY !== "undefined" && OPENAI_API_KEY) {
    return OPENAI_API_KEY;
  }
  // No embedded fallback key in the repository: require a local `secrets.js`.
  return DEFAULT_OPENAI_API_KEY || null;
}

/* Initialize: load products and set up listeners */
(async function init() {
  allProducts = await loadProducts();

  // load persisted selections once we have allProducts available
  loadSelectedProducts();

  // show any selected products saved from previous session
  updateSelectedProductsList();

  // When the category changes, filter and display products
  categoryFilter.addEventListener("change", (e) => {
    const selectedCategory = e.target.value;
    const filteredProducts = allProducts.filter(
      (product) => product.category === selectedCategory
    );
    displayProducts(filteredProducts);
  });

  // Click handler for products area (event delegation)
  productsContainer.addEventListener("click", (e) => {
    // If the info button was clicked, open the modal and stop
    const infoBtn = e.target.closest(".info-btn");
    if (infoBtn) {
      const id = Number(infoBtn.getAttribute("data-id"));
      openProductModal(id);
      return;
    }

    // Otherwise treat card click as selection toggle
    const card = e.target.closest(".product-card");
    if (!card) return;
    const id = Number(card.getAttribute("data-id"));
    toggleProductSelection(id);
  });

  // Keyboard accessibility: Enter/Space should activate focused element
  productsContainer.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      // If focus is on the info button, open modal
      const infoBtn = e.target.closest(".info-btn");
      if (infoBtn) {
        e.preventDefault();
        const id = Number(infoBtn.getAttribute("data-id"));
        openProductModal(id);
        return;
      }

      // Otherwise toggle selection for the focused card
      const card = e.target.closest(".product-card");
      if (!card) return;
      e.preventDefault();
      const id = Number(card.getAttribute("data-id"));
      toggleProductSelection(id);
    }
  });

  // Modal close handlers: backdrop and close button
  const modal = document.getElementById("productModal");
  modal.addEventListener("click", (e) => {
    const actionEl = e.target.closest("[data-action='close']");
    if (actionEl) closeProductModal();
  });

  // Close with Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modalEl = document.getElementById("productModal");
      if (modalEl && modalEl.classList.contains("open")) {
        closeProductModal();
      }
    }
  });

  // Click handler for remove buttons in the selected products list
  selectedProductsList.addEventListener("click", (e) => {
    const btn = e.target.closest(".remove-btn");
    if (!btn) return;
    const id = Number(btn.getAttribute("data-id"));
    removeSelected(id);
  });

  // Initial empty selected products UI
  updateSelectedProductsList();
})();

/* Utility: render chatWindow from conversationMessages (skip system message visually) */
function renderChatWindow() {
  // show messages after the system message
  const visible = conversationMessages.filter((m) => m.role !== "system");
  if (visible.length === 0) {
    chatWindow.innerHTML = `<div class="placeholder-message">No messages yet. Generate a routine or ask a question.</div>`;
    return;
  }
  chatWindow.innerHTML = visible
    .map((m) => {
      const cls = m.role === "user" ? "chat-msg-user" : "chat-msg-assistant";
      // escape content minimally - for this beginner example we keep plain text rendering and preserve line breaks
      return `<div class="${cls}" style="margin-bottom:12px;"><strong>${
        m.role === "user" ? "You" : "Assistant"
      }:</strong><div style="white-space:pre-wrap;margin-top:6px;">${
        m.content
      }</div></div>`;
    })
    .join("");
  // scroll to bottom
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Helper: sanitize description and other text before sending to the API */
function sanitizeText(text, maxLen = 300) {
  if (!text) return "";
  // collapse whitespace and trim
  let s = String(text).replace(/\s+/g, " ").trim();
  if (s.length > maxLen) s = s.slice(0, maxLen).trim() + "…";
  return s;
}

/* Build product payload (only allowed fields: name, brand, category, description)
   This avoids sending image URLs, ids, or any other fields from products.json. */
function getSelectedProductsPayload() {
  return Array.from(selectedProductIds)
    .map((id) => {
      const p = allProducts.find((x) => x.id === id);
      if (!p) return null;
      return {
        name: p.name || "",
        brand: p.brand || "",
        category: p.category || "",
        // send a short, sanitized description only
        description: sanitizeText(p.description || "", 300),
      };
    })
    .filter(Boolean);
}

/* Send messages array to OpenAI Chat Completions and return assistant content */
async function sendChatMessagesAndGetReply(messages) {
  const url = "https://api.openai.com/v1/chat/completions";

  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "OpenAI API key not set. Create a local secrets.js with: const OPENAI_API_KEY = 'sk-...'; and add it to .gitignore."
    );
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      max_tokens: 800,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const content =
    data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : null;
  return content;
}

/* Add hidden messages that are sent to the API but not shown in the chat window */
const hiddenApiMessages = []; // will hold product payloads (role:user) — NOT rendered

/* Generate routine by sending only the sanitized selected products to the API */
async function generateRoutine() {
  const selected = getSelectedProductsPayload();
  if (selected.length === 0) {
    chatWindow.innerHTML = `<div class="placeholder-message">Please select at least one product to generate a routine.</div>`;
    return;
  }

  // Use the provided secrets.js key (via getApiKey)
  if (!getApiKey()) {
    chatWindow.innerHTML = `<div class="placeholder-message">OpenAI API key is not set. Create a local <code>secrets.js</code> with <code>const OPENAI_API_KEY = "sk-...";</code> and add that file to .gitignore.</div>`;
    return;
  }

  // Build a concise user payload (hidden) that includes only sanitized data
  const userPayload = {
    role: "user",
    content: `Here are the selected products (minimal data only). Create a routine using only these items. For each step, mention which product(s) to use and why.\n\n${JSON.stringify(
      selected,
      null,
      2
    )}`,
  };

  // IMPORTANT: do NOT add userPayload to conversationMessages (so it won't show in chat)
  // Instead store it in hiddenApiMessages so it will be included in future API requests
  hiddenApiMessages.push(userPayload);

  // Build messages for API: system + hidden product payloads + visible conversation (excluding system)
  const messagesForApi = [
    conversationMessages[0],
    ...hiddenApiMessages,
    ...conversationMessages.slice(1),
  ];

  // show loading state to the user and disable button
  chatWindow.innerHTML = `<div class="placeholder-message">Generating routine…</div>`;
  generateRoutineBtn.disabled = true;

  try {
    const assistantContent = await sendChatMessagesAndGetReply(messagesForApi);
    if (!assistantContent)
      throw new Error("No reply content returned from the API.");

    // Save assistant reply in conversation (visible) and render.
    // Do NOT add the product payload to visible messages.
    conversationMessages.push({ role: "assistant", content: assistantContent });
    renderChatWindow();
  } catch (err) {
    chatWindow.innerHTML = `<div class="placeholder-message">Error generating routine: ${err.message}</div>`;
  } finally {
    generateRoutineBtn.disabled = false;
  }
}

/* Validator: allow follow-up questions only if they mention allowed keywords or any known product/brand name */
function isAllowedQuestion(text) {
  if (!text || !text.trim()) return false;
  const s = text.toLowerCase();

  // basic allowed keywords (can be extended)
  const allowedKeywords = [
    "routine",
    "product",
    "skincare",
    "skin",
    "haircare",
    "hair",
    "makeup",
    "mascara",
    "foundation",
    "fragrance",
    "scent",
    "sunscreen",
    "spf",
    "cleanser",
    "moisturizer",
    "serum",
    "retinol",
    "vitamin c",
    "hydration",
    "acne",
    "tone",
    "texture",
    "conditioner",
    "shampoo",
    "apply",
    "when to use",
    "how to use",
    "step",
    "steps",
    "morning",
    "night",
    "pm",
    "am",
    "routine step",
  ];

  for (const k of allowedKeywords) {
    if (s.includes(k)) return true;
  }

  // also accept if user mentions any known product name or brand from allProducts
  for (const p of allProducts) {
    if (!p) continue;
    const name = (p.name || "").toLowerCase();
    const brand = (p.brand || "").toLowerCase();
    if (name && s.includes(name)) return true;
    if (brand && s.includes(brand)) return true;
  }

  return false;
}

/* Chat form submission handler — allows follow-up questions after a routine is generated */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;

  // Ensure OpenAI API key set (use session/getter)
  if (!getApiKey()) {
    chatWindow.innerHTML = `<div class="placeholder-message">OpenAI API key is not set. Create a local <code>secrets.js</code> with <code>const OPENAI_API_KEY = "sk-...";</code> and add that file to .gitignore.</div>`;
    return;
  }

  // Enforce topic restriction locally before sending to the API
  if (!isAllowedQuestion(text)) {
    conversationMessages.push({
      role: "assistant",
      content:
        "I can only help with the generated routine or questions about skincare, haircare, makeup, fragrance, or how to use the products. Please rephrase your question to relate to those topics.",
    });
    renderChatWindow();
    input.value = "";
    return;
  }

  // Add user's follow-up to visible conversation and render
  conversationMessages.push({ role: "user", content: text });
  renderChatWindow();

  // clear input and append transient assistant placeholder
  input.value = "";
  const loadingIndex =
    conversationMessages.push({ role: "assistant", content: "..." }) - 1;
  renderChatWindow();

  try {
    // Build messages for API: system + hidden product payloads + visible conversation (excluding system)
    const messagesForApi = [
      conversationMessages[0],
      ...hiddenApiMessages,
      ...conversationMessages.slice(1),
    ];

    // Send combined messages; hiddenApiMessages ensures products are included but not shown
    const assistantContent = await sendChatMessagesAndGetReply(messagesForApi);
    if (!assistantContent)
      throw new Error("No reply content returned from the API.");

    // Replace placeholder with real assistant content (visible)
    conversationMessages[loadingIndex] = {
      role: "assistant",
      content: assistantContent,
    };
    renderChatWindow();
  } catch (err) {
    conversationMessages[loadingIndex] = {
      role: "assistant",
      content: `Error responding: ${err.message}`,
    };
    renderChatWindow();
  }
});

/* Wire Generate Routine button to new function */
generateRoutineBtn.removeEventListener &&
  generateRoutineBtn.removeEventListener("click", () => {});
generateRoutineBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  await generateRoutine();
});
