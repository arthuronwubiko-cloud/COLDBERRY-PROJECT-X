const fs = require("fs");
const path = require("path");

const artDir = "/home/antigravity/.gemini/jetski/brain/v1/default/jetski_remote_agents_3p/96f62b39-fb0f-4160-9381-450b45af2475";
const imgDir = "/home/antigravity/arthuronwubiko-cloud/COLDBERRY-PROJECT-X/images";

const FLAVOURS = [
  { id: "vanilla", name: "Coldberry Vanilla Bean", tier: "traditional", img: "fresh-cream.jpg", color: "#FFF8E7" },
  { id: "strawberry", name: "Strawberry Bliss Swirl", tier: "traditional", img: "strawberry.jpg", color: "#FFB6C1" },
  { id: "chocolate", name: "Chocolate Supreme", tier: "traditional", img: "chocolate.jpg", color: "#5C3A21" },
  { id: "bluemoon", name: "Blue Moon Magic", tier: "traditional", img: "bluemoon.jpg", color: "#4A90E2" },
  { id: "banana", name: "Golden Banana Wave", tier: "traditional", img: "banana.jpg", color: "#FFDF00" },
  { id: "bubblegum", name: "Bubble Gum Blast", tier: "special", img: "bubble-gum.jpg", color: "#FF69B4" },
  { id: "coffee", name: "Cold Brew Mocha Crunch", tier: "special", img: "coffee.jpg", color: "#8B5A2B" },
  { id: "popcorn", name: "Caramel Popcorn Crunch", tier: "special", img: "pop-corn.jpg", color: "#F4A460" },
  { id: "sweetcookies", name: "Sweet Cookies & Cream", tier: "special", img: "sweet-cookies.jpg", color: "#D2B48C" },
  { id: "baileys", name: "Baileys Irish Velvet", tier: "exclusive", img: "baileys.jpg", color: "#C3A06E" },
  { id: "jackdaniels", name: "Tennessee Fudge Ripple", tier: "exclusive", img: "jack-daniels.jpg", color: "#3B1E08" },
  { id: "tropical", name: "Tropical Passionfruit Scoop", tier: "exclusive", img: "tropical.jpg", color: "#FF7F50" }
];

const flavourData = FLAVOURS.map(f => {
  const filePath = path.join(imgDir, f.img);
  let base64 = "";
  if (fs.existsSync(filePath)) {
    const ext = path.extname(f.img).slice(1) === "png" ? "png" : "jpeg";
    base64 = "data:image/" + ext + ";base64," + fs.readFileSync(filePath).toString("base64");
  }
  return { ...f, dataUri: base64 };
});

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <script src="https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js"></script>
  <style>
    :root {
      --primary: #5C1A2B;
      --foreground: #1E293B;
      --muted-foreground: #64748B;
      --card: #FFFFFF;
      --border: #E2E8F0;
      --accent: #F0A83B;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --foreground: #F8FAFC;
        --muted-foreground: #94A3B8;
        --card: #181418;
        --border: #2D262D;
      }
    }
    .tub-shadow {
      filter: drop-shadow(0 15px 25px rgba(92, 26, 43, 0.25));
    }
  </style>
</head>
<body class="bg-transparent text-[var(--foreground)] antialiased p-0 m-0 font-sans">
  <div class="py-2 space-y-4 max-w-xl mx-auto">
    <div class="p-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md">
      <!-- Title -->
      <div class="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <div>
          <h2 class="text-base font-bold text-[var(--foreground)] flex items-center gap-2">
            <span>🍨</span> Coldberry Custom Tub Visualizer
          </h2>
          <p class="text-xs text-[var(--muted-foreground)]">Authentic photos from coldberry.ng/menu/ · Live 2/3/4 Split Simulator</p>
        </div>
        <span class="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
          ● Ready to Build
        </span>
      </div>

      <!-- Size Selector Tabs -->
      <div class="mt-4">
        <div class="grid grid-cols-3 gap-2 text-xs font-semibold">
          <button id="tab-med" onclick="selectSize('Medium')" class="py-2.5 px-2 rounded-xl border border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm transition-all text-center">
            <span class="block font-bold">Medium (500ml)</span>
            <span class="text-[10px] opacity-90">2 Flavours (50/50 Split)</span>
          </button>
          <button id="tab-lrg" onclick="selectSize('Large')" class="py-2.5 px-2 rounded-xl border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--primary)] transition-all text-center">
            <span class="block font-bold">Large (1 Litre)</span>
            <span class="text-[10px] opacity-90 text-[var(--muted-foreground)]">3 Flavours (1/3rd Each)</span>
          </button>
          <button id="tab-chm" onclick="selectSize('Champion')" class="py-2.5 px-2 rounded-xl border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--primary)] transition-all text-center">
            <span class="block font-bold">Champion (2L Tub)</span>
            <span class="text-[10px] opacity-90 text-[var(--muted-foreground)]">4 Flavours (Quad Split)</span>
          </button>
        </div>
      </div>

      <!-- Interactive Playground -->
      <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
        <!-- Visual Tub Canvas -->
        <div class="flex flex-col items-center justify-center p-4 rounded-2xl bg-gradient-to-b from-stone-50 to-stone-100 dark:from-stone-900/40 dark:to-stone-950/40 border border-[var(--border)]">
          <!-- Rim Tub Container -->
          <div class="relative w-44 h-44 rounded-full p-2 bg-gradient-to-tr from-amber-200 via-amber-100 to-amber-300 dark:from-stone-700 dark:via-stone-600 dark:to-stone-800 tub-shadow flex items-center justify-center">
            <svg id="tub-svg" class="w-full h-full rounded-full overflow-hidden" viewBox="0 0 100 100">
              <defs id="svg-defs"></defs>
              <g id="tub-slices"></g>
            </svg>
            <div class="absolute inset-0 rounded-full border-4 border-amber-300/40 pointer-events-none"></div>
          </div>

          <!-- Price & Formula Display -->
          <div class="mt-3 text-center">
            <div id="price-display" class="text-base font-extrabold text-[var(--primary)] dark:text-[#E57388]">₦11,760</div>
            <div id="formula-display" class="text-[11px] text-[var(--muted-foreground)] mt-0.5">Custom Multi-Flavour Tub</div>
          </div>
        </div>

        <!-- Flavour Dropdowns Column -->
        <div class="space-y-2.5 text-xs">
          <div>
            <label class="block font-semibold text-[var(--foreground)] mb-1 flex items-center justify-between">
              <span>Flavour 1 <span class="text-[var(--muted-foreground)] font-normal">(Left Half)</span></span>
              <span id="badge-f1" class="text-[10px] text-[var(--muted-foreground)]">Traditional</span>
            </label>
            <select id="select-f1" onchange="renderTub()" class="w-full p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] font-medium">
            </select>
          </div>

          <div>
            <label class="block font-semibold text-[var(--foreground)] mb-1 flex items-center justify-between">
              <span>Flavour 2 <span class="text-[var(--muted-foreground)] font-normal">(Right Half)</span></span>
              <span id="badge-f2" class="text-[10px] text-[var(--muted-foreground)]">Traditional</span>
            </label>
            <select id="select-f2" onchange="renderTub()" class="w-full p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] font-medium">
            </select>
          </div>

          <div id="group-f3" class="hidden">
            <label class="block font-semibold text-[var(--foreground)] mb-1 flex items-center justify-between">
              <span>Flavour 3 <span class="text-[var(--muted-foreground)] font-normal">(Bottom / 3rd Wedge)</span></span>
              <span id="badge-f3" class="text-[10px] text-[var(--muted-foreground)]">Special</span>
            </label>
            <select id="select-f3" onchange="renderTub()" class="w-full p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] font-medium">
            </select>
          </div>

          <div id="group-f4" class="hidden">
            <label class="block font-semibold text-[var(--foreground)] mb-1 flex items-center justify-between">
              <span>Flavour 4 <span class="text-[var(--muted-foreground)] font-normal">(Top-Left / 4th Quadrant)</span></span>
              <span id="badge-f4" class="text-[10px] text-[var(--muted-foreground)]">Exclusive</span>
            </label>
            <select id="select-f4" onchange="renderTub()" class="w-full p-2 rounded-lg border border-[var(--border)] bg-transparent text-[var(--foreground)] font-medium">
            </select>
          </div>
        </div>
      </div>

      <!-- Feature Pill Checklist -->
      <div class="mt-4 pt-3 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
        <span class="flex items-center gap-1">✨ <strong>Medium</strong>: 2 Flavours</span>
        <span class="flex items-center gap-1">✨ <strong>Large</strong>: 3 Flavours</span>
        <span class="flex items-center gap-1">✨ <strong>Champion</strong>: 4 Flavours</span>
        <span class="flex items-center gap-1">🚫 <strong>Nineoverload</strong> Purged</span>
      </div>
    </div>
  </div>

  <script>
    const FLAVOUR_LIST = ${JSON.stringify(flavourData)};
    const TIERS = {
      traditional: { Medium: 11200, Large: 14150, Champion: 21200 },
      special: { Medium: 12200, Large: 14800, Champion: 22000 },
      exclusive: { Medium: 13500, Large: 15000, Champion: 23500 }
    };

    let activeSize = "Medium";

    function populateSelects() {
      const selects = ["select-f1", "select-f2", "select-f3", "select-f4"];
      selects.forEach((sid, idx) => {
        const el = document.getElementById(sid);
        el.innerHTML = "";
        FLAVOUR_LIST.forEach((f) => {
          const opt = document.createElement("option");
          opt.value = f.id;
          opt.textContent = f.name + " (" + f.tier.toUpperCase() + ")";
          if (idx === 0 && f.id === "strawberry") opt.selected = true;
          if (idx === 1 && f.id === "chocolate") opt.selected = true;
          if (idx === 2 && f.id === "bluemoon") opt.selected = true;
          if (idx === 3 && f.id === "baileys") opt.selected = true;
          el.appendChild(opt);
        });
      });
    }

    function selectSize(size) {
      activeSize = size;
      ["med", "lrg", "chm"].forEach(t => {
        const btn = document.getElementById("tab-" + t);
        const isActive = (t === "med" && size === "Medium") || (t === "lrg" && size === "Large") || (t === "chm" && size === "Champion");
        btn.className = "py-2.5 px-2 rounded-xl border transition-all text-center " + 
          (isActive 
            ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm" 
            : "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--primary)]");
      });

      document.getElementById("group-f3").classList.toggle("hidden", size === "Medium");
      document.getElementById("group-f4").classList.toggle("hidden", size !== "Champion");

      renderTub();
    }

    function renderTub() {
      const s1 = document.getElementById("select-f1").value;
      const s2 = document.getElementById("select-f2").value;
      const s3 = document.getElementById("select-f3").value;
      const s4 = document.getElementById("select-f4").value;

      const f1 = FLAVOUR_LIST.find(x => x.id === s1) || FLAVOUR_LIST[0];
      const f2 = FLAVOUR_LIST.find(x => x.id === s2) || FLAVOUR_LIST[1];
      const f3 = FLAVOUR_LIST.find(x => x.id === s3) || FLAVOUR_LIST[2];
      const f4 = FLAVOUR_LIST.find(x => x.id === s4) || FLAVOUR_LIST[3];

      document.getElementById("badge-f1").textContent = f1.tier.toUpperCase();
      document.getElementById("badge-f2").textContent = f2.tier.toUpperCase();
      document.getElementById("badge-f3").textContent = f3.tier.toUpperCase();
      document.getElementById("badge-f4").textContent = f4.tier.toUpperCase();

      let activeFlavours = [f1, f2];
      if (activeSize === "Large") activeFlavours = [f1, f2, f3];
      if (activeSize === "Champion") activeFlavours = [f1, f2, f3, f4];

      // Defs
      const defs = document.getElementById("svg-defs");
      defs.innerHTML = "";
      activeFlavours.forEach((f, i) => {
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        pattern.setAttribute("id", "pat-" + i);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", "100");
        pattern.setAttribute("height", "100");

        if (f.dataUri) {
          const img = document.createElementNS("http://www.w3.org/2000/svg", "image");
          img.setAttribute("href", f.dataUri);
          img.setAttribute("x", "0");
          img.setAttribute("y", "0");
          img.setAttribute("width", "100");
          img.setAttribute("height", "100");
          img.setAttribute("preserveAspectRatio", "xMidYMid slice");
          pattern.appendChild(img);
        } else {
          const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rect.setAttribute("width", "100");
          rect.setAttribute("height", "100");
          rect.setAttribute("fill", f.color);
          pattern.appendChild(rect);
        }
        defs.appendChild(pattern);
      });

      // Slices
      const group = document.getElementById("tub-slices");
      group.innerHTML = "";

      if (activeFlavours.length === 2) {
        group.innerHTML = \`
          <path d="M 50 0 A 50 50 0 0 0 50 100 Z" fill="url(#pat-0)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 0 A 50 50 0 0 1 50 100 Z" fill="url(#pat-1)" stroke="#FFFFFF" stroke-width="1.5"/>
        \`;
      } else if (activeFlavours.length === 3) {
        group.innerHTML = \`
          <path d="M 50 50 L 50 0 A 50 50 0 0 1 93.3 75 Z" fill="url(#pat-0)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 50 L 93.3 75 A 50 50 0 0 1 6.7 75 Z" fill="url(#pat-1)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 50 L 6.7 75 A 50 50 0 0 1 50 0 Z" fill="url(#pat-2)" stroke="#FFFFFF" stroke-width="1.5"/>
        \`;
      } else if (activeFlavours.length === 4) {
        group.innerHTML = \`
          <path d="M 50 50 L 50 0 A 50 50 0 0 1 100 50 Z" fill="url(#pat-0)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 50 L 100 50 A 50 50 0 0 1 50 100 Z" fill="url(#pat-1)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 50 L 50 100 A 50 50 0 0 1 0 50 Z" fill="url(#pat-2)" stroke="#FFFFFF" stroke-width="1.5"/>
          <path d="M 50 50 L 0 50 A 50 50 0 0 1 50 0 Z" fill="url(#pat-3)" stroke="#FFFFFF" stroke-width="1.5"/>
        \`;
      }

      // Calculate Prices
      const prices = activeFlavours.map(f => TIERS[f.tier][activeSize]);
      const basePrice = Math.max(...prices);
      const surcharge = Math.round(basePrice * 0.05);
      const grandTotal = basePrice + surcharge;

      document.getElementById("price-display").textContent = "₦" + grandTotal.toLocaleString();
      document.getElementById("formula-display").textContent = 
        "Custom Tub: " + activeFlavours.length + " Signature Varieties (" + activeSize + ")";
    }

    populateSelects();
    selectSize("Medium");
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(artDir, "coldberry_tub_visualizer.html"), html, "utf8");
console.log("Visualizer generated successfully at " + path.join(artDir, "coldberry_tub_visualizer.html"));
