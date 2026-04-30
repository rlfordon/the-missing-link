const DEFAULT_MODEL = "claude-sonnet-4-6";

const $ = (id) => document.getElementById(id);

async function load() {
  const { apiKey, model } = await browser.storage.local.get(["apiKey", "model"]);
  if (apiKey) $("apiKey").value = apiKey;
  const selected = model || DEFAULT_MODEL;
  const radio = document.querySelector(`input[name="model"][value="${selected}"]`);
  if (radio) radio.checked = true;
}

document.querySelectorAll('input[name="model"]').forEach((radio) => {
  radio.addEventListener("change", async () => {
    if (radio.checked) await browser.storage.local.set({ model: radio.value });
  });
});

$("toggleShow").addEventListener("click", () => {
  const el = $("apiKey");
  if (el.type === "password") {
    el.type = "text";
    $("toggleShow").textContent = "hide";
  } else {
    el.type = "password";
    $("toggleShow").textContent = "show";
  }
});

$("save").addEventListener("click", async () => {
  const key = $("apiKey").value.trim();
  await browser.storage.local.set({ apiKey: key });
  const saved = $("saved");
  saved.textContent = "saved ✓";
  setTimeout(() => (saved.textContent = ""), 1800);
});

load();
