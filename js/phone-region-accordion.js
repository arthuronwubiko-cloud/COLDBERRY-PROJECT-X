/* Region-Grouped Accordion Phone Code Selector (Korapay-style Flag + Short Code + Dial Code) */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const REGIONS = [
    {
      id: "africa",
      label: "🌍 Africa",
      defaultOpen: true,
      countries: [
        ["🇳🇬", "NGA", "+234", "Nigeria"],
        ["🇬🇭", "GHA", "+233", "Ghana"],
        ["🇿🇦", "ZAF", "+27", "South Africa"],
        ["🇰🇪", "KEN", "+254", "Kenya"],
        ["🇪🇬", "EGY", "+20", "Egypt"],
        ["🇩🇿", "DZA", "+213", "Algeria"],
        ["🇦🇴", "AGO", "+244", "Angola"],
        ["🇧🇯", "BEN", "+229", "Benin"],
        ["🇧🇼", "BWA", "+267", "Botswana"],
        ["🇧🇫", "BFA", "+226", "Burkina Faso"],
        ["🇧🇮", "BDI", "+257", "Burundi"],
        ["🇨🇲", "CMR", "+237", "Cameroon"],
        ["🇨🇻", "CPV", "+238", "Cape Verde"],
        ["🇨🇫", "CAF", "+236", "Central African Republic"],
        ["🇹🇩", "TCD", "+235", "Chad"],
        ["🇰🇲", "COM", "+269", "Comoros"],
        ["🇨🇬", "COG", "+242", "Congo"],
        ["🇨🇩", "COD", "+243", "Congo (DRC)"],
        ["🇨🇮", "CIV", "+225", "Côte d'Ivoire"],
        ["🇩🇯", "DJI", "+253", "Djibouti"],
        ["🇬🇶", "GNQ", "+240", "Equatorial Guinea"],
        ["🇪🇷", "ERI", "+291", "Eritrea"],
        ["🇸🇿", "SWZ", "+268", "Eswatini"],
        ["🇪🇹", "ETH", "+251", "Ethiopia"],
        ["🇬🇦", "GAB", "+241", "Gabon"],
        ["🇬🇲", "GMB", "+220", "Gambia"],
        ["🇬🇳", "GIN", "+224", "Guinea"],
        ["🇬🇼", "GNB", "+245", "Guinea-Bissau"],
        ["🇱🇸", "LSO", "+266", "Lesotho"],
        ["🇱🇷", "LBR", "+231", "Liberia"],
        ["🇱🇾", "LBY", "+218", "Libya"],
        ["🇲🇬", "MDG", "+261", "Madagascar"],
        ["🇲🇼", "MWI", "+265", "Malawi"],
        ["🇲🇱", "MLI", "+223", "Mali"],
        ["🇲🇷", "MRT", "+222", "Mauritania"],
        ["🇲🇺", "MUS", "+230", "Mauritius"],
        ["🇲🇦", "MAR", "+212", "Morocco"],
        ["🇲🇿", "MOZ", "+258", "Mozambique"],
        ["🇳🇦", "NAM", "+264", "Namibia"],
        ["🇳🇪", "NER", "+227", "Niger"],
        ["🇷🇼", "RWA", "+250", "Rwanda"],
        ["🇸🇳", "SEN", "+221", "Senegal"],
        ["🇸🇨", "SYC", "+248", "Seychelles"],
        ["🇸🇱", "SLE", "+232", "Sierra Leone"],
        ["🇸🇴", "SOM", "+252", "Somalia"],
        ["🇸🇸", "SSD", "+211", "South Sudan"],
        ["🇸🇩", "SDN", "+249", "Sudan"],
        ["🇹🇿", "TZA", "+255", "Tanzania"],
        ["🇹🇬", "TGO", "+228", "Togo"],
        ["🇹🇳", "TUN", "+216", "Tunisia"],
        ["🇺🇬", "UGA", "+256", "Uganda"],
        ["🇿🇲", "ZMB", "+260", "Zambia"],
        ["🇿🇼", "ZWE", "+263", "Zimbabwe"],
      ],
    },
    {
      id: "europe",
      label: "🇪🇺 Europe",
      countries: [
        ["🇬🇧", "GBR", "+44", "United Kingdom"],
        ["🇫🇷", "FRA", "+33", "France"],
        ["🇩🇪", "DEU", "+49", "Germany"],
        ["🇮🇪", "IRL", "+353", "Ireland"],
        ["🇮🇹", "ITA", "+39", "Italy"],
        ["🇪🇸", "ESP", "+34", "Spain"],
        ["🇳🇱", "NLD", "+31", "Netherlands"],
        ["🇧🇪", "BEL", "+32", "Belgium"],
        ["🇨🇭", "CHE", "+41", "Switzerland"],
        ["🇵🇹", "PRT", "+351", "Portugal"],
        ["🇸🇪", "SWE", "+46", "Sweden"],
        ["🇳🇴", "NOR", "+47", "Norway"],
        ["🇩🇰", "DNK", "+45", "Denmark"],
        ["🇫🇮", "FIN", "+358", "Finland"],
        ["🇦🇹", "AUT", "+43", "Austria"],
        ["🇵🇱", "POL", "+48", "Poland"],
        ["🇬🇷", "GRC", "+30", "Greece"],
        ["🇨🇿", "CZE", "+420", "Czechia"],
        ["🇭🇺", "HUN", "+36", "Hungary"],
        ["🇷🇴", "ROU", "+40", "Romania"],
        ["🇧🇬", "BGR", "+359", "Bulgaria"],
        ["🇭🇷", "HRV", "+385", "Croatia"],
        ["🇸🇰", "SVK", "+421", "Slovakia"],
        ["🇸🇮", "SVN", "+386", "Slovenia"],
        ["🇪🇪", "EST", "+372", "Estonia"],
        ["🇱🇻", "LVA", "+371", "Latvia"],
        ["🇱🇹", "LTU", "+370", "Lithuania"],
        ["🇱🇺", "LUX", "+352", "Luxembourg"],
        ["🇲🇹", "MLT", "+356", "Malta"],
        ["🇨🇾", "CYP", "+357", "Cyprus"],
        ["🇮🇸", "ISL", "+354", "Iceland"],
        ["🇦🇱", "ALB", "+355", "Albania"],
        ["🇦🇩", "AND", "+376", "Andorra"],
        ["🇧🇾", "BLR", "+375", "Belarus"],
        ["🇧🇦", "BIH", "+387", "Bosnia & Herzegovina"],
        ["🇱🇮", "LIE", "+423", "Liechtenstein"],
        ["🇲🇩", "MDA", "+373", "Moldova"],
        ["🇲🇨", "MCO", "+377", "Monaco"],
        ["🇲🇪", "MNE", "+382", "Montenegro"],
        ["🇲🇰", "MKD", "+389", "North Macedonia"],
        ["🇷🇸", "SRB", "+381", "Serbia"],
        ["🇺🇦", "UKR", "+380", "Ukraine"],
      ],
    },
    {
      id: "americas",
      label: "🌎 Americas",
      countries: [
        ["🇺🇸", "USA", "+1", "United States"],
        ["🇨🇦", "CAN", "+1", "Canada"],
        ["🇧🇷", "BRA", "+55", "Brazil"],
        ["🇲🇽", "MEX", "+52", "Mexico"],
        ["🇦🇷", "ARG", "+54", "Argentina"],
        ["🇨🇴", "COL", "+57", "Colombia"],
        ["🇨🇱", "CHL", "+56", "Chile"],
        ["🇵🇪", "PER", "+51", "Peru"],
        ["🇻🇪", "VEN", "+58", "Venezuela"],
        ["🇪🇨", "ECU", "+593", "Ecuador"],
        ["🇧🇴", "BOL", "+591", "Bolivia"],
        ["🇵🇾", "PRY", "+595", "Paraguay"],
        ["🇺🇾", "URY", "+598", "Uruguay"],
        ["🇬🇾", "GUY", "+592", "Guyana"],
        ["🇨🇷", "CRI", "+506", "Costa Rica"],
        ["🇵🇦", "PAN", "+507", "Panama"],
        ["🇬🇹", "GTM", "+502", "Guatemala"],
        ["🇭🇳", "HND", "+504", "Honduras"],
        ["🇸🇻", "SLV", "+503", "El Salvador"],
        ["🇳🇮", "NIC", "+505", "Nicaragua"],
        ["🇧🇿", "BLZ", "+501", "Belize"],
        ["🇯🇲", "JAM", "+1876", "Jamaica"],
        ["🇹🇹", "TTO", "+1868", "Trinidad & Tobago"],
        ["🇧🇸", "BHS", "+1242", "Bahamas"],
        ["🇧🇧", "BRB", "+1246", "Barbados"],
        ["🇩🇴", "DOM", "+1809", "Dominican Republic"],
        ["🇭🇹", "HTI", "+509", "Haiti"],
        ["🇨🇺", "CUB", "+53", "Cuba"],
      ],
    },
    {
      id: "asia",
      label: "🌏 Asia",
      countries: [
        ["🇮🇳", "IND", "+91", "India"],
        ["🇨🇳", "CHN", "+86", "China"],
        ["🇯🇵", "JPN", "+81", "Japan"],
        ["🇰🇷", "KOR", "+82", "South Korea"],
        ["🇵🇭", "PHL", "+63", "Philippines"],
        ["🇸🇬", "SGP", "+65", "Singapore"],
        ["🇲🇾", "MYS", "+60", "Malaysia"],
        ["🇮🇩", "IDN", "+62", "Indonesia"],
        ["🇹🇭", "THA", "+66", "Thailand"],
        ["🇻🇳", "VNM", "+84", "Vietnam"],
        ["🇵🇰", "PAK", "+92", "Pakistan"],
        ["🇧🇩", "BGD", "+880", "Bangladesh"],
        ["🇱🇰", "LKA", "+94", "Sri Lanka"],
        ["🇳🇵", "NPL", "+977", "Nepal"],
        ["🇭🇰", "HKG", "+852", "Hong Kong"],
        ["🇹🇼", "TWN", "+886", "Taiwan"],
        ["🇦🇫", "AFG", "+93", "Afghanistan"],
        ["🇦🇲", "ARM", "+374", "Armenia"],
        ["🇦🇿", "AZE", "+994", "Azerbaijan"],
        ["🇧🇹", "BTN", "+975", "Bhutan"],
        ["🇧🇳", "BRN", "+673", "Brunei"],
        ["🇰🇭", "KHM", "+855", "Cambodia"],
        ["🇬🇪", "GEO", "+995", "Georgia"],
        ["🇰🇿", "KAZ", "+7", "Kazakhstan"],
        ["🇰🇬", "KGZ", "+996", "Kyrgyzstan"],
        ["🇱🇦", "LAO", "+856", "Laos"],
        ["🇲🇻", "MDV", "+960", "Maldives"],
        ["🇲🇳", "MNG", "+976", "Mongolia"],
        ["🇲🇲", "MMR", "+95", "Myanmar"],
        ["🇷🇺", "RUS", "+7", "Russia"],
        ["🇺🇿", "UZB", "+998", "Uzbekistan"],
      ],
    },
    {
      id: "middle-east",
      label: "🕌 Middle East",
      countries: [
        ["🇦🇪", "ARE", "+971", "United Arab Emirates"],
        ["🇸🇦", "SAU", "+966", "Saudi Arabia"],
        ["🇶🇦", "QAT", "+974", "Qatar"],
        ["🇰🇼", "KWT", "+965", "Kuwait"],
        ["🇧🇭", "BHR", "+973", "Bahrain"],
        ["🇴🇲", "OMN", "+968", "Oman"],
        ["🇹🇷", "TUR", "+90", "Turkey"],
        ["🇮🇱", "ISR", "+972", "Israel"],
        ["🇯🇴", "JOR", "+962", "Jordan"],
        ["🇱🇧", "LBN", "+961", "Lebanon"],
        ["🇮🇶", "IRQ", "+964", "Iraq"],
        ["🇮🇷", "IRN", "+98", "Iran"],
        ["🇸🇾", "SYR", "+963", "Syria"],
        ["🇾🇪", "YEM", "+967", "Yemen"],
      ],
    },
    {
      id: "oceania",
      label: "🏝️ Oceania",
      countries: [
        ["🇦🇺", "AUS", "+61", "Australia"],
        ["🇳🇿", "NZL", "+64", "New Zealand"],
        ["🇫🇯", "FJI", "+679", "Fiji"],
        ["🇵🇬", "PNG", "+675", "Papua New Guinea"],
      ],
    },
  ];

  function injectStyles() {
    if (document.getElementById("romeos-phone-accordion-styles")) return;
    const style = document.createElement("style");
    style.id = "romeos-phone-accordion-styles";
    style.textContent = `
      .rpa-wrap { position: relative; width: 100%; }
      .rpa-input-group {
        display: flex; align-items: stretch; width: 100%;
        border: 1px solid rgba(128,128,128,0.34); border-radius: 10px;
        overflow: hidden; background: transparent;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .rpa-input-group:focus-within {
        border-color: #db2777;
        box-shadow: 0 0 0 2px rgba(219,39,119,0.18);
      }
      .rpa-trigger {
        display: inline-flex; align-items: center; gap: 0.4rem;
        padding: 0.7rem 0.75rem; border: 0;
        border-right: 1px solid rgba(128,128,128,0.28);
        background: rgba(128,128,128,0.08); color: inherit;
        font-weight: 700; font-size: 0.9rem; cursor: pointer;
        white-space: nowrap; flex: 0 0 auto;
      }
      .rpa-trigger:hover { background: rgba(219,39,119,0.1); }
      .rpa-trigger-code { opacity: 0.85; font-family: monospace; font-size: 0.88rem; }
      .rpa-chevron { font-size: 0.75rem; transition: transform 0.2s ease; }
      .rpa-phone-input {
        flex: 1; min-width: 0; border: 0 !important; border-radius: 0 !important;
        padding: 0.7rem 0.85rem; background: transparent; color: inherit;
        font-size: 16px; outline: none;
      }
      .rpa-preview {
        margin-top: 0.35rem; font-size: 0.78rem; opacity: 0.8;
        font-family: monospace;
      }
      .rpa-panel {
        margin-top: 0.45rem; border: 1px solid rgba(128,128,128,0.32);
        border-radius: 12px; padding: 0.65rem;
        background: var(--surface, #ffffff);
        box-shadow: 0 12px 28px rgba(0,0,0,0.14);
      }
      :root[data-theme="dark"] .rpa-panel { background: #1a1217; color: #faf6f2; }
      .rpa-search {
        width: 100%; padding: 0.55rem 0.75rem; border-radius: 8px;
        border: 1px solid rgba(128,128,128,0.3); background: transparent;
        color: inherit; font-size: 16px; margin-bottom: 0.55rem; box-sizing: border-box;
      }
      .rpa-regions { max-height: 260px; overflow-y: auto; display: grid; gap: 0.4rem; }
      .rpa-region-box {
        border: 1px solid rgba(128,128,128,0.2); border-radius: 9px; overflow: hidden;
      }
      .rpa-region-btn {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        padding: 0.55rem 0.75rem; border: 0; background: rgba(128,128,128,0.07);
        color: inherit; font-weight: 800; font-size: 0.85rem; cursor: pointer; text-align: left;
      }
      .rpa-region-btn:hover { background: rgba(219,39,119,0.12); }
      .rpa-country-list { display: grid; gap: 0.15rem; padding: 0.35rem; }
      .rpa-country-item {
        width: 100%; display: flex; align-items: center; justify-content: space-between;
        gap: 0.5rem; padding: 0.48rem 0.6rem; border: 0; border-radius: 7px;
        background: transparent; color: inherit; font-size: 0.85rem; cursor: pointer; text-align: left;
      }
      .rpa-country-item:hover, .rpa-country-item[aria-selected="true"] {
        background: rgba(219,39,119,0.15); font-weight: 700;
      }
      .rpa-country-dial { font-family: monospace; opacity: 0.8; font-weight: 700; }
      [hidden] { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  function mount({ phoneInputId, hiddenCodeId, defaultIso = "NGA" }) {
    injectStyles();
    const phoneInput = document.getElementById(phoneInputId);
    if (!phoneInput || phoneInput.dataset.rpaMounted === "1") return;
    phoneInput.dataset.rpaMounted = "1";

    let current = ["🇳🇬", "NGA", "+234", "Nigeria"];
    for (const reg of REGIONS) {
      const found = reg.countries.find((c) => c[1] === defaultIso);
      if (found) { current = found; break; }
    }

    const wrap = document.createElement("div");
    wrap.className = "rpa-wrap";

    const hiddenCode = document.createElement("input");
    hiddenCode.type = "hidden";
    hiddenCode.id = hiddenCodeId;
    hiddenCode.value = current[2];

    const group = document.createElement("div");
    group.className = "rpa-input-group";

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "rpa-trigger";
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-label", "Select region and country dialing code");
    trigger.innerHTML = `<span class="rpa-trigger-flag">${current[0]}</span> <span class="rpa-trigger-iso">${current[1]}</span> <span class="rpa-trigger-code">${current[2]}</span> <span class="rpa-chevron">▾</span>`;

    phoneInput.classList.add("rpa-phone-input");
    phoneInput.parentNode.insertBefore(wrap, phoneInput);
    group.appendChild(trigger);
    group.appendChild(phoneInput);
    wrap.appendChild(hiddenCode);
    wrap.appendChild(group);

    const preview = document.createElement("div");
    preview.className = "rpa-preview";
    preview.hidden = true;
    wrap.appendChild(preview);

    const panel = document.createElement("div");
    panel.className = "rpa-panel";
    panel.hidden = true;
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "Choose your region and country code");

    const search = document.createElement("input");
    search.type = "search";
    search.className = "rpa-search";
    search.placeholder = "Search country, short code (NGA), or +code...";
    search.setAttribute("aria-label", "Search country or dialing code");
    panel.appendChild(search);

    const regionsBox = document.createElement("div");
    regionsBox.className = "rpa-regions";

    REGIONS.forEach((reg) => {
      const box = document.createElement("div");
      box.className = "rpa-region-box";

      const regBtn = document.createElement("button");
      regBtn.type = "button";
      regBtn.className = "rpa-region-btn";
      const isDefaultOpen = Boolean(reg.defaultOpen);
      regBtn.setAttribute("aria-expanded", isDefaultOpen ? "true" : "false");
      regBtn.innerHTML = `<span>${reg.label} <small style="opacity:0.65;font-weight:600;">(${reg.countries.length})</small></span><span class="rpa-reg-chev">${isDefaultOpen ? "▴" : "▾"}</span>`;

      const list = document.createElement("div");
      list.className = "rpa-country-list";
      list.hidden = !isDefaultOpen;

      reg.countries.forEach(([flag, iso, code, name]) => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "rpa-country-item";
        item.dataset.iso = iso;
        item.dataset.code = code;
        item.setAttribute("aria-selected", iso === current[1] ? "true" : "false");
        item.innerHTML = `<span>${flag} <strong>${iso}</strong> · ${name}</span><span class="rpa-country-dial">${code}</span>`;
        item.addEventListener("click", () => {
          current = [flag, iso, code, name];
          hiddenCode.value = code;
          trigger.querySelector(".rpa-trigger-flag").textContent = flag;
          trigger.querySelector(".rpa-trigger-iso").textContent = iso;
          trigger.querySelector(".rpa-trigger-code").textContent = code;
          panel.querySelectorAll(".rpa-country-item").forEach((b) => {
            b.setAttribute("aria-selected", b === item ? "true" : "false");
          });
          setOpen(false);
          updatePreview();
          phoneInput.focus();
        });
        list.appendChild(item);
      });

      regBtn.addEventListener("click", () => {
        const willOpen = list.hidden;
        list.hidden = !willOpen;
        regBtn.setAttribute("aria-expanded", willOpen ? "true" : "false");
        regBtn.querySelector(".rpa-reg-chev").textContent = willOpen ? "▴" : "▾";
      });

      box.appendChild(regBtn);
      box.appendChild(list);
      regionsBox.appendChild(box);
    });

    panel.appendChild(regionsBox);
    wrap.appendChild(panel);

    function setOpen(open) {
      panel.hidden = !open;
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      trigger.querySelector(".rpa-chevron").style.transform = open ? "rotate(180deg)" : "rotate(0deg)";
      if (open) search.focus();
    }

    function updatePreview() {
      const raw = phoneInput.value.trim();
      if (!raw) {
        preview.hidden = true;
        return;
      }
      const digits = raw.replace(/\D/g, "");
      if (!digits) {
        preview.hidden = true;
        return;
      }
      const combined = raw.startsWith("+")
        ? `+${digits}`
        : `${hiddenCode.value}${digits.replace(/^0+/, "")}`;
      preview.textContent = `Full number: ${combined}`;
      preview.hidden = false;
    }

    trigger.addEventListener("click", () => setOpen(panel.hidden));
    phoneInput.addEventListener("input", updatePreview);

    search.addEventListener("input", () => {
      const q = search.value.trim().toLowerCase();
      regionsBox.querySelectorAll(".rpa-region-box").forEach((box) => {
        const regBtn = box.querySelector(".rpa-region-btn");
        const list = box.querySelector(".rpa-country-list");
        const items = Array.from(box.querySelectorAll(".rpa-country-item"));
        let matches = 0;
        items.forEach((item) => {
          const hit = !q || item.textContent.toLowerCase().includes(q);
          item.hidden = !hit;
          if (hit) matches++;
        });
        box.hidden = Boolean(q) && matches === 0;
        if (q && matches > 0) {
          list.hidden = false;
          regBtn.setAttribute("aria-expanded", "true");
          regBtn.querySelector(".rpa-reg-chev").textContent = "▴";
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !panel.hidden) setOpen(false);
    });
  }

  window.RomeosPhoneAccordion = { mount, REGIONS };
})();
