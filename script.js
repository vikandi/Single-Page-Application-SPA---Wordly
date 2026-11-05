const API_URL = "https://api.dictionaryapi.dev/api/v2/entries/en/"; // URL for the dictionary API

const form = document.getElementById("search-form");
const input = document.getElementById("search-input");
const message = document.getElementById("message");
const results = document.getElementById("results");
const favoritesList = document.getElementById("favorites-list");
const themeToggle = document.getElementById("theme-toggle");

let favorites = JSON.parse(localStorage.getItem("wordlyFavorites")) || [];

const esc = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function showMessage(text, isInfo = false) {
  message.textContent = text;
  message.className = isInfo ? "info" : "";
}

async function fetchWord(word) {
  const response = await fetch(API_URL + encodeURIComponent(word));
  if (response.status === 404) throw new Error("NOT_FOUND");
  if (!response.ok) throw new Error("REQUEST_FAILED");
  return response.json();
}

function renderEntry(entry) {
  const word = entry.word.toLowerCase();
  const phonetic = entry.phonetic || (entry.phonetics || []).find((p) => p.text)?.text;
  let audio = (entry.phonetics || []).find((p) => p.audio)?.audio;
  if (audio?.startsWith("//")) audio = "https:" + audio;

  const meanings = (entry.meanings || [])
    .map((m) => {
      const definitions = (m.definitions || [])
        .map((d, i) => {
          const synonyms = [...new Set([...(d.synonyms || []), ...(m.synonyms || [])])];
          return `
            <p class="definition">${i + 1}. ${esc(d.definition)}</p>
            <p class="example">${d.example ? `Example: "${esc(d.example)}"` : "No example available."}</p>
            <p class="synonyms">${
              synonyms.length
                ? "<strong>Synonyms: </strong>" + synonyms.map((s) => `<span class="chip">${esc(s)}</span>`).join("")
                : "No synonyms available."
            }</p>`;
        })
        .join("");
      return `<h3 class="pos">${esc(m.partOfSpeech || "unknown")}</h3>${definitions}`;
    })
    .join("");

  return `
    <article class="card" data-word="${esc(word)}">
      <div class="word-row">
        <h2 class="word-title">${esc(entry.word)}</h2>
        <div class="actions">
          ${
            audio
              ? `<button class="secondary" data-action="play" data-audio="${esc(audio)}" aria-label="Play pronunciation of ${esc(entry.word)}">Listen</button>`
              : `<button class="secondary" disabled>No audio</button>`
          }
          <button data-action="save"></button>
        </div>
      </div>
      <p class="phonetic">${phonetic ? `/${esc(phonetic.replace(/\//g, ""))}/` : "Pronunciation not available"}</p>
      ${meanings}
      ${entry.origin ? `<p class="origin">Origin: ${esc(entry.origin)}</p>` : ""}
    </article>`;
}

function toggleFavorite(word) {
  favorites = favorites.includes(word) ? favorites.filter((w) => w !== word) : [...favorites, word];
  localStorage.setItem("wordlyFavorites", JSON.stringify(favorites));
  renderFavorites();
  syncCards();
}

// Updates the highlight and Save button text on every card on screen
function syncCards() {
  document.querySelectorAll(".card").forEach((card) => {
    const saved = favorites.includes(card.dataset.word);
    const btn = card.querySelector('[data-action="save"]');
    card.classList.toggle("saved", saved);
    btn.textContent = saved ? "Saved" : "Save";
    btn.setAttribute("aria-label", `${saved ? "Remove" : "Save"} ${card.dataset.word}`);
  });
}

function renderFavorites() {
  favoritesList.innerHTML = favorites.length
    ? favorites
        .map(
          (word) => `
        <li>
          <span>${esc(word)}</span>
          <div class="actions">
            <button class="secondary" data-action="view" data-word="${esc(word)}">View</button>
            <button class="secondary" data-action="remove" data-word="${esc(word)}">Remove</button>
          </div>
        </li>`
        )
        .join("")
    : '<li class="empty">No saved words yet.</li>';
}

async function search(word) {
  results.innerHTML = "";
  showMessage("Searching...", true);
  try {
    const data = await fetchWord(word);
    showMessage("");
    results.innerHTML = data.map(renderEntry).join("");
    syncCards();
  } catch (err) {
    if (err.message === "NOT_FOUND") {
      showMessage(`Sorry, "${word}" was not found. Check the spelling and try again.`);
    } else if (err.message === "REQUEST_FAILED") {
      showMessage("The dictionary service returned an error. Please try again later.");
    } else {
      showMessage("Network error. Please check your internet connection.");
    }
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const word = input.value.trim();
  if (!word) return showMessage("Please enter a word to search.");
  if (!/^[\p{L}'\- ]+$/u.test(word)) return showMessage("Invalid input. Use letters only (no numbers or symbols).");
  search(word);
});

// One listener handles the Listen and Save buttons inside the results
results.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  if (btn.dataset.action === "play") new Audio(btn.dataset.audio).play();
  if (btn.dataset.action === "save") toggleFavorite(btn.closest(".card").dataset.word);
});

// One listener handles the View and Remove buttons in the saved list
favoritesList.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const word = btn.dataset.word;
  if (btn.dataset.action === "view") {
    input.value = word;
    search(word);
  }
  if (btn.dataset.action === "remove") toggleFavorite(word);
});

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("wordlyTheme", document.body.classList.contains("dark") ? "dark" : "light");
});

if (localStorage.getItem("wordlyTheme") === "dark") document.body.classList.add("dark");
renderFavorites();