const $ = (id) => document.getElementById(id);

async function load() {
  const { apiKey } = await browser.storage.local.get("apiKey");
  if (apiKey) $("apiKey").value = apiKey;
}

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
