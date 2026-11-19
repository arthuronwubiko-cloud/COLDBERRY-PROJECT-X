// Role-Based Order Verification & State Management API for Romeo's Pizza Nigeria.
// Supports separate-origin hosting (CORS), 14-character alphanumeric Admin & Staff
// authentication, HMAC session tokens, and strict RBAC:
// - admin: full read (unmasked PII), change any state, cancel orders, delete orders, export
// - staff: state-change only (confirmed, preparing, out_for_delivery, ready, completed);
//          customer PII masked; cancel & delete forbidden (HTTP 403).

const crypto = require("crypto");
const {
  getOrders,
  updateOrderStatus,
  deleteOrder,
  ORDER_STATUSES,
  findOrderById,
  saveRefundToken,
  getRefundTokens,
  findRefundToken,
  claimRefundToken,
  deleteRefundToken,
  deleteClaimedRefundTokens,
  recordVisitorHit,
  getActiveVisitorCount,
  getFeedback,
  deleteFeedback,
  getCustomerUsers,
  deleteCustomerUser,
  saveCustomerMessage,
  getAllCustomerMessages,
  savePromotionalEmail,
  getPromotionalEmails,
} = require("./db");

const CREDENTIAL_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{14}$/;
const STAFF_ALLOWED_STATUSES = ["confirmed", "preparing", "out_for_delivery", "ready", "completed"];
const DRIVER_ALLOWED_STATUSES = ["out_for_delivery", "completed"];
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPromoEmailHtml({ subject, textBody, ctaText, ctaUrl }) {
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(textBody).replace(/\r?\n/g, "<br/>");
  const safeCtaUrl = /^https?:\/\//i.test(String(ctaUrl || "")) ? String(ctaUrl) : "";
  const safeCtaText = escapeHtml(ctaText || "Order Now");
  const ctaBlock = safeCtaUrl
    ? `<div style="margin:24px 0;"><a href="${escapeHtml(safeCtaUrl)}" style="display:inline-block;background:#e63946;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:8px;">${safeCtaText}</a></div>`
    : "";
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f7f4ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1e1e1e;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #eadfd2;">
    <div style="background:#1c1917;color:#ffffff;padding:20px 24px;">
      <div style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#f59e0b;font-weight:700;">Coldberry Ice Cream Nigeria</div>
      <h1 style="margin:6px 0 0;font-size:20px;line-height:1.3;">${safeSubject}</h1>
    </div>
    <div style="padding:24px;font-size:15px;line-height:1.6;">
      <p style="margin:0 0 16px;">${safeBody}</p>
      ${ctaBlock}
      <hr style="border:none;border-top:1px solid #eee4d8;margin:24px 0;" />
      <p style="margin:0;font-size:12px;color:#6b7280;">You received this promotional update because you registered an account with Coldberry Ice Cream Nigeria.</p>
    </div>
  </div>
</body></html>`;
}

async function dispatchPromoEmails({ recipients, subject, textBody, ctaText, ctaUrl }) {
  const html = buildPromoEmailHtml({ subject, textBody, ctaText, ctaUrl });
  const fromEmail = process.env.PROMO_FROM_EMAIL || "Coldberry Ice Cream Nigeria <onboarding@resend.dev>";

  if (process.env.RESEND_API_KEY) {
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];
    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ from: fromEmail, to: [to], subject, html, text: textBody }),
        });
        if (resp.ok) sentCount += 1;
        else {
          failedCount += 1;
          errors.push(`${to}: HTTP ${resp.status}`);
        }
      } catch (err) {
        failedCount += 1;
        errors.push(`${to}: ${err.message}`);
      }
    }
    return { provider: "resend", sentCount, failedCount, errors };
  }

  if (process.env.BREVO_API_KEY) {
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];
    const senderEmail = (fromEmail.match(/<([^>]+)>/) || [])[1] || fromEmail;
    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            "api-key": process.env.BREVO_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: { name: "Coldberry Ice Cream Nigeria", email: senderEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: textBody,
          }),
        });
        if (resp.ok) sentCount += 1;
        else {
          failedCount += 1;
          errors.push(`${to}: HTTP ${resp.status}`);
        }
      } catch (err) {
        failedCount += 1;
        errors.push(`${to}: ${err.message}`);
      }
    }
    return { provider: "brevo", sentCount, failedCount, errors };
  }

  if (process.env.SENDGRID_API_KEY) {
    let sentCount = 0;
    let failedCount = 0;
    const errors = [];
    const senderEmail = (fromEmail.match(/<([^>]+)>/) || [])[1] || fromEmail;
    for (const to of recipients) {
      try {
        const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: to }] }],
            from: { email: senderEmail, name: "Coldberry Ice Cream Nigeria" },
            subject,
            content: [
              { type: "text/plain", value: textBody },
              { type: "text/html", value: html },
            ],
          }),
        });
        if (resp.ok) sentCount += 1;
        else {
          failedCount += 1;
          errors.push(`${to}: HTTP ${resp.status}`);
        }
      } catch (err) {
        failedCount += 1;
        errors.push(`${to}: ${err.message}`);
      }
    }
    return { provider: "sendgrid", sentCount, failedCount, errors };
  }

  return { provider: "preview_log", sentCount: recipients.length, failedCount: 0, errors: [] };
}

// Default 14-char alphanumeric SHA-256 digests (overridable via environment variables)
const DEFAULT_ADMIN_USER_SHA256 = "7c1b0c180024d6adffaced672b335015f4903f1ad3b8655bde67c5662b2abd49";
const DEFAULT_ADMIN_PASS_SHA256 = "ee5c41ee35d3093beeed33399a5e202c30dbfaf45d01eaded0d64c0b4a65920c";
const DEFAULT_STAFF_USER_SHA256 = "f53c870b5ebfc26167f0769cf4c5a0aba18237e7fd8c15ae23b4f1fcd626b1c2";
const DEFAULT_STAFF_PASS_SHA256 = "48d34a3857a2de233934580a1fcc5224c68f709ac02d66a088a62f53d6d44cbc";
const DEFAULT_DRIVER_USER_SHA256 = "93278e709aa4c10b5a5db34cffd1830934195ea311d328a148e0801fedccfe00";
const DEFAULT_DRIVER_PASS_SHA256 = "505d0df56267597acafdc8ebb0f65f78a1ee14a0399113e761cef56e1e9120c5";

const ADDITIONAL_ADMIN_DIGESTS = [
  {
    // ColdAdmin8901A / Adm73Jx91Qp42K
    user: "525588808ec88fdc20b746f21dd47a12934457d24adaf87c96af8c87e490c9fa",
    pass: "deb6c65e11fe122704b619ede279141d7e4f1e82469f9298d076724f080d3638",
  },
  {
    // ColdAdmin8902B / Adm84Ky62Rp53M
    user: "eeb0ab32a86d20d9764901cce65526f33579c77f7ef2075c6334126145510888",
    pass: "5316850e5e3178785e5dd553a65e226d9667771879009928e5b5bd5ac6226f6e",
  },
  {
    // ColdberryAdm89 / Adm94Kx72Qp81Z
    user: "f9145e3fe7f18a7d759a9ec1c9e3fd6b1f2acdcc9e9bdaf6410b1ed804a4f24b",
    pass: "ee5c41ee35d3093beeed33399a5e202c30dbfaf45d01eaded0d64c0b4a65920c",
  },
  {
    user: "447d7a85a470e758e833d551de73a519c89ccef52e83e33e11073cbb4e883248",
    pass: "1260ee87ef6130ee5faa7fd203003a73630366f3dbf9a8a94962177000aeddf9",
  },
  {
    user: "5dcdd0e9d9285413dd48d5a39ee69e95bffeaa66035ea9af958a48efbc02ee98",
    pass: "15b92858e33a6b945a75a05bfeacd8acb6e15aec90ddfa3d327626abd2da4789",
  },
];

const ADDITIONAL_STAFF_DIGESTS = [
  {
    // ColdStaff8901A / Stf11Ab22Cd33E
    user: "9910a1c262dcfa2a9ce894d0d84d84e59b2787836011b460251a1d070c3dd1e0",
    pass: "5b94efb5db37c3edb0f81aa6c7d328cb68b1245fd345f49da1a41453e5c04f90",
  },
  {
    // ColdStaff8902B / Stf22Bc33De44F
    user: "1e8c892512247cdc4eaef868dcc871ba6a71543274d43a627de45a12c1f8850f",
    pass: "a653c1919b396a56fa1561b39e17cfadd4f079a456362599f35eaef221fe6312",
  },
  {
    // ColdStaff8903C / Stf33Cd44Ef55G
    user: "4e7b914ffcfe367e597177bde849b75ff03ee876db6d2b5cbb12644592392abf",
    pass: "24d39b68115c46a1213bb472f87d9374cad4428723674670de662373d453cab5",
  },
  {
    // ColdStaff8904D / Stf44De55Fg66H
    user: "f9fc44207a3286f0bd76d988646bc0fee3d8f67f573c821a9d08892f73b0a0af",
    pass: "bd85e33978ffc3c6849fe47f635a9d64863fdfff676a2f06c01837dad0f13a90",
  },
  {
    // ColdStaff8905E / Stf55Ef66Gh77J
    user: "44a48520c2745c0d14a656461872e391aa2ca13e623904ba5de752a984bacd3c",
    pass: "d669d2256f05fa593692a9450dece020ebb9f2afd8d8b40a5ee324730ac4c14b",
  },
  {
    // ColdStaff8906F / Stf66Fg77Hj88K
    user: "fc9aeb1349d65d774540f25eff78a4d48058c414b313805df3a90124f1009247",
    pass: "3bf00b3c8456b9e1be0440d10891765654dcc7f40dac1dd312fce8e1dada6f9f",
  },
  {
    // ColdStaff8907G / Stf77Gh88Jk99L
    user: "69b9c3318f5632d5d5bcafa5232e3a43228f0c1cddd6b17361ef357a7c076c3a",
    pass: "af721e01add2cb1139dd5e85f55f151be28aa0b4962cec753f44a3dfe7e1dae3",
  },
  {
    user: "953d2cbf5dd927a621f6fb7fcb2224638255bce896a12ce54c3c738c770cff64",
    pass: "2ffcb37896a35596033c39ee3bda35eecf69c35a0985811b0ff3b66e4fa39593",
  },
  {
    user: "049c4273b4eb254fc8d9f7f4e63b47709f99e2fc2aedc48c7b59192b56018583",
    pass: "519c4a53b09c96ba125792959035f664b8461fb6e739626fac422d22934b867b",
  },
  {
    user: "511e772c99ba6431c37b75af8e45283a7239a5017ff6f1c7d88a4dec2f890eb8",
    pass: "f073cbe9c6514548e45ff08af989e4db744bdd2e968126e274d6614bd5e72301",
  },
  {
    user: "0da56f17bb0f13c765915367c56b53c67b3f582b81e2eccae7bafa5eced35a45",
    pass: "2c66cdca8fbb7039924bceb6bd94ffdc818795d551c8999136aa7bdaf8593a48",
  },
  {
    user: "dca8dfe3de3ae17a2151153bc8ae609dbafe980500bf146faacbff2b0ddb86ab",
    pass: "a5847378e2b675c3ffe0b6ad539595b000d2784aa97fc82cd6c0f2879cb9b61b",
  },
  {
    user: "4fe2b4876cf0f7a8e3764de7fa8bb56b243728a14135dcf366ac2c4d98ffd633",
    pass: "87d0523a1fce6e74a785020925cd941db2a56d81d8adef4d0b3a35ef018a0a6a",
  },
  {
    user: "f5b4ba79959b2890437f163350fa8701396e0ab993d076524f4b23103c52d164",
    pass: "0ae003dca480becc680ef666e5c85097d4b1aa533f342dbd5a3477eeb1876425",
  },
];

const ADDITIONAL_DRIVER_DIGESTS = [
  {
    // ColdRider8901A / Rdr11Ab22Cd33E
    user: "b5b38ec8121028fa901bb3b5d180fa6c82a1b17069c798344af0a1328c2e147e",
    pass: "2a0f21b4717a538c174e136e0b03ffb254fcdfa804078b75c6c5af365c6a8d1c",
  },
  {
    // ColdRider8902B / Rdr22Bc33De44F
    user: "ab7c359f383ea8edb9d998737c3c7499d586cc7588dd989ed0f7b620dbba5aac",
    pass: "d60969bc94e54417c7a3d045fa98310e50b3a77dd142625be0f31c562bdc3295",
  },
  {
    // ColdRider8903C / Rdr33Cd44Ef55G
    user: "d4e1c2d80a8d00160c0c36263fc6f6ffdce7fa9bc27ef3181bac8e5721c4891d",
    pass: "5c09024dc51fac453608a9fd8dd54871898a2a7a51441a54e643b649271e6032",
  },
  {
    // ColdRider8904D / Rdr44De55Fg66H
    user: "51d0e2da2d2681135f51fd11c5d2d2824cb4e64f37a6cfa1a7ffeeaa9b578510",
    pass: "ce7af9c90549891b952d305c6f808f6ac125d7958f3610886bb84d02f9cbda08",
  },
  {
    // ColdRider8905E / Rdr55Ef66Gh77J
    user: "17b5343497ce8030044dd95277ff1b36ae25572d566c468e250b5f8715f8d07a",
    pass: "7c534d7265266ded741a6f03628f833e5b9cdf63d81ea2e2b3e652ff030ced6b",
  },
  {
    // ColdRider8906F / Rdr66Fg77Hj88K
    user: "bb10bf999a5506344b00080300ec4ec6302a5dff387c8501ec965ae943e9ad24",
    pass: "e7342e157968ca30866b9d98612e778a6b28fc4c28e45611b3e801b958d790ed",
  },
  {
    // ColdRider8907G / Rdr77Gh88Jk99L
    user: "88a572e7bbbba30ca91bb4e4942ca2a531867cfe2cadc2a76b01b4332787ef68",
    pass: "62b3f26ccfdeb6eafcca2e8126b67f16def414ced62b1a2f7c6bc5b29b37c523",
  },
];

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function timingSafeHexEqual(hexA, hexB) {
  if (!hexA || !hexB || hexA.length !== hexB.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(hexA, "hex"), Buffer.from(hexB, "hex"));
  } catch (_) {
    return false;
  }
}

let ephemeralAdminSigningKey = null;
function getSigningKey() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SECRET;
  if (secret) return secret;
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    throw new Error("ADMIN_SESSION_SECRET or ADMIN_SECRET must be configured in production.");
  }
  if (!ephemeralAdminSigningKey) {
    ephemeralAdminSigningKey = crypto.randomBytes(32).toString("hex");
  }
  return ephemeralAdminSigningKey;
}

function generate15CharRefundToken() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "";
  const bytes = crypto.randomBytes(15);
  for (let i = 0; i < 15; i++) {
    token += chars[bytes[i] % chars.length];
  }
  return token;
}

function getExpectedDigests() {
  return {
    adminUser: process.env.ADMIN_USERNAME ? sha256Hex(process.env.ADMIN_USERNAME) : DEFAULT_ADMIN_USER_SHA256,
    adminPass: process.env.ADMIN_PASSWORD ? sha256Hex(process.env.ADMIN_PASSWORD) : DEFAULT_ADMIN_PASS_SHA256,
    staffUser: process.env.STAFF_USERNAME ? sha256Hex(process.env.STAFF_USERNAME) : DEFAULT_STAFF_USER_SHA256,
    staffPass: process.env.STAFF_PASSWORD ? sha256Hex(process.env.STAFF_PASSWORD) : DEFAULT_STAFF_PASS_SHA256,
    driverUser: process.env.DRIVER_USERNAME ? sha256Hex(process.env.DRIVER_USERNAME) : DEFAULT_DRIVER_USER_SHA256,
    driverPass: process.env.DRIVER_PASSWORD ? sha256Hex(process.env.DRIVER_PASSWORD) : DEFAULT_DRIVER_PASS_SHA256,
  };
}

function authenticateCredentials(username, password) {
  if (!CREDENTIAL_REGEX.test(String(username || "")) || !CREDENTIAL_REGEX.test(String(password || ""))) {
    return { invalidFormat: true };
  }
  const uHex = sha256Hex(username);
  const pHex = sha256Hex(password);
  const expected = getExpectedDigests();

  if (timingSafeHexEqual(uHex, expected.adminUser) && timingSafeHexEqual(pHex, expected.adminPass)) {
    return { username, role: "admin" };
  }
  for (const cred of ADDITIONAL_ADMIN_DIGESTS) {
    if (timingSafeHexEqual(uHex, cred.user) && timingSafeHexEqual(pHex, cred.pass)) {
      return { username, role: "admin" };
    }
  }
  if (timingSafeHexEqual(uHex, expected.staffUser) && timingSafeHexEqual(pHex, expected.staffPass)) {
    return { username, role: "staff" };
  }
  for (const cred of ADDITIONAL_STAFF_DIGESTS) {
    if (timingSafeHexEqual(uHex, cred.user) && timingSafeHexEqual(pHex, cred.pass)) {
      return { username, role: "staff" };
    }
  }
  if (timingSafeHexEqual(uHex, expected.driverUser) && timingSafeHexEqual(pHex, expected.driverPass)) {
    return { username, role: "driver" };
  }
  for (const cred of ADDITIONAL_DRIVER_DIGESTS) {
    if (timingSafeHexEqual(uHex, cred.user) && timingSafeHexEqual(pHex, cred.pass)) {
      return { username, role: "driver" };
    }
  }
  return null;
}

function issueSessionToken(username, role) {
  const payload = Buffer.from(
    JSON.stringify({
      u: username,
      r: role,
      exp: Date.now() + SESSION_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, providedSig] = parts;
  const expectedSig = crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
  if (providedSig.length !== expectedSig.length) return null;
  try {
    if (!crypto.timingSafeEqual(Buffer.from(providedSig, "utf8"), Buffer.from(expectedSig, "utf8"))) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded || !decoded.r || !decoded.u || Date.now() > Number(decoded.exp || 0)) {
      return null;
    }
    return { username: decoded.u, role: decoded.r };
  } catch (_) {
    return null;
  }
}

function resolveAuthFromRequest(req) {
  const headers = req.headers || {};

  // 1. Bearer session token or legacy ADMIN_SECRET
  const bearer = headers.authorization?.startsWith("Bearer ") ? headers.authorization.slice(7).trim() : null;
  const querySecret = req.query?.secret || null;
  const candidateToken = bearer || querySecret;

  if (candidateToken) {
    const tokenAuth = verifySessionToken(candidateToken);
    if (tokenAuth) return tokenAuth;

    const envSecret = process.env.ADMIN_SECRET;
    if (envSecret && candidateToken === envSecret) {
      return { username: "env-admin", role: "admin" };
    }
  }

  // 2. Custom credential headers (X-Auth-Username + X-Auth-Password)
  const hdrUser = headers["x-auth-username"];
  const hdrPass = headers["x-auth-password"];
  if (hdrUser && hdrPass) {
    const auth = authenticateCredentials(hdrUser, hdrPass);
    if (auth && !auth.invalidFormat) return auth;
  }

  // 3. HTTP Basic auth header
  if (headers.authorization?.startsWith("Basic ")) {
    try {
      const decoded = Buffer.from(headers.authorization.slice(6).trim(), "base64").toString("utf8");
      const sep = decoded.indexOf(":");
      if (sep > 0) {
        const u = decoded.slice(0, sep);
        const p = decoded.slice(sep + 1);
        const auth = authenticateCredentials(u, p);
        if (auth && !auth.invalidFormat) return auth;
      }
    } catch (_) {}
  }

  return null;
}

function maskPhone(phone) {
  const str = String(phone || "");
  if (str.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, str.length - 4))}${str.slice(-4)}`;
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return null;
  const parts = email.split("@");
  if (parts.length !== 2) return "***@***";
  const user = parts[0];
  const domain = parts[1];
  const maskedUser = user.length > 2 ? user[0] + "***" + user.slice(-1) : "***";
  return `${maskedUser}@${domain}`;
}

function sanitizeOrderForStaff(order) {
  const fullName = String(order.customer_name || order.customerName || "Customer").trim();
  const firstName = fullName.split(/\s+/)[0] || "Customer";
  return {
    order_id: order.order_id || order.orderId,
    order_pin: order.order_pin || order.orderPin || null,
    customer_name: firstName,
    customer_phone: maskPhone(order.customer_phone || order.customerPhone),
    fulfilment: order.fulfilment,
    location: order.location,
    items: order.items,
    notes: order.notes,
    status: order.status || "pending",
    created_at: order.created_at || order.timestamp,
    subtotal: Number(order.subtotal ?? order.sub_total ?? 0),
    service_fee: Number(order.service_fee ?? order.serviceFee ?? 800),
    delivery_fee: Number(order.delivery_fee ?? order.deliveryFee ?? 0),
    grand_total: Number(order.grand_total ?? order.grandTotal ?? 0),
    payment_status: order.payment_status || order.paymentStatus || "pending",
  };
}

function sanitizeOrderForDriver(order) {
  return {
    order_id: order.order_id || order.orderId,
    order_pin: order.order_pin || order.orderPin || null,
    customer_name: order.customer_name || order.customerName || "Customer",
    customer_phone: order.customer_phone || order.customerPhone || "",
    customer_email: maskEmail(order.customer_email || order.customerEmail || order.email),
    address: order.address || "",
    fulfilment: order.fulfilment || "Delivery",
    location: order.location || "",
    items: order.items || "",
    notes: order.notes || "",
    status: order.status || "pending",
    created_at: order.created_at || order.timestamp,
    subtotal: Number(order.subtotal ?? order.sub_total ?? 0),
    service_fee: Number(order.service_fee ?? order.serviceFee ?? 800),
    delivery_fee: Number(order.delivery_fee ?? order.deliveryFee ?? 0),
    grand_total: Number(order.grand_total ?? order.grandTotal ?? 0),
    payment_status: order.payment_status || order.paymentStatus || "pending",
  };
}

function getPermissionsForRole(role) {
  if (role === "admin") {
    return ["read_all", "change_state", "cancel", "delete", "export"];
  }
  if (role === "driver") {
    return ["read_deliveries", "change_delivery_state"];
  }
  return ["change_state"];
}

function parseBody(req) {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return req.body || {};
}

module.exports = async function handler(req, res) {
  const { checkRateLimit, getClientIp, getCorsOrigin } = require("./overload-protection");
  res.setHeader("Cache-Control", "no-store");
  const allowedOrigin = getCorsOrigin(req);
  if (allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Auth-Username, X-Auth-Password");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE, OPTIONS");
    return res.status(405).json({ error: "Method not allowed." });
  }

  // POST actions
  if (req.method === "POST") {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(clientIp, 30, 60 * 1000, "admin_post");
    if (!rate.allowed) {
      res.setHeader("Retry-After", String(rate.retryAfter));
      return res.status(429).json({ error: "Too many requests. Please wait a minute." });
    }

    const body = parseBody(req);
    const action = String(body.action || "").toLowerCase();

    // 1. Verify Refund Token (requires admin or staff authentication)
    if (action === "verify_refund_token" || action === "verify_refund") {
      const postAuth = resolveAuthFromRequest(req);
      if (!postAuth) {
        return res.status(401).json({ error: "Unauthorized. Admin or staff authentication required." });
      }
      if (postAuth.role !== "admin" && postAuth.role !== "staff") {
        return res.status(403).json({ error: "Access denied: Only admin or staff accounts can verify refund tokens." });
      }
      const token = String(body.token || body.refundToken || "").trim().toUpperCase();
      if (!token) return res.status(400).json({ error: "Refund token is required." });
      const rec = await findRefundToken(token);
      if (!rec) return res.status(404).json({ valid: false, error: "Refund token not found or invalid." });
      return res.status(200).json({
        valid: true,
        verified: true,
        token: rec.token,
        refundToken: rec.token,
        orderId: rec.order_id,
        customerName: rec.customer_name,
        customerPhone: postAuth.role === "admin" ? rec.customer_phone : maskPhone(rec.customer_phone),
        refundedAmount: Number(rec.amount),
        amount: Number(rec.amount),
        reason: rec.reason,
        issuedBy: rec.issued_by,
        issuedAt: rec.issued_at,
        status: rec.status,
        claimedAt: rec.claimed_at,
        checkedIn: rec.status === "claimed",
      });
    }

    // 2. Check-In / Claim Refund Token (requires admin or staff authentication)
    if (action === "check_in_refund" || action === "claim_refund" || action === "checkin_refund") {
      const postAuth = resolveAuthFromRequest(req);
      if (!postAuth) {
        return res.status(401).json({ error: "Unauthorized. Admin or staff authentication required." });
      }
      if (postAuth.role !== "admin" && postAuth.role !== "staff") {
        return res.status(403).json({ error: "Access denied: Only admin or staff accounts can claim refund tokens." });
      }
      const token = String(body.token || body.refundToken || "").trim().toUpperCase();
      if (!token) return res.status(400).json({ error: "Refund token is required." });
      const claimRes = await claimRefundToken(token, postAuth.username);
      if (claimRes.error) {
        return res.status(400).json({ error: claimRes.error, record: claimRes.record, alreadyClaimed: claimRes.alreadyClaimed });
      }
      return res.status(200).json({
        success: true,
        claimed: true,
        checkedIn: true,
        token: claimRes.token,
        record: claimRes.record,
      });
    }

    // 3. Heartbeat / active visitor recording
    if (action === "heartbeat") {
      const hitCount = recordVisitorHit(body.clientId || req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress);
      return res.status(200).json({ activeVisitors: hitCount });
    }

    // 4. Admin Broadcast or Direct Message to Customers
    if (action === "send_message") {
      const postAuth = resolveAuthFromRequest(req);
      if (!postAuth || postAuth.role !== "admin") {
        return res.status(403).json({ error: "Access denied: Only admin accounts can send customer messages." });
      }
      const msgRes = await saveCustomerMessage({
        recipientUsername: body.target || body.recipientUsername || "ALL",
        recipientPhone: body.recipientPhone || null,
        sender: postAuth.username,
        title: body.title || "",
        body: body.message || body.body || "",
      });
      if (msgRes.error) {
        return res.status(400).json({ error: msgRes.error });
      }
      return res.status(200).json(msgRes);
    }

    // 5. Admin Promotional Email Campaign (Admin Only)
    if (action === "send_promo_email") {
      const postAuth = resolveAuthFromRequest(req);
      if (!postAuth || postAuth.role !== "admin") {
        return res.status(403).json({ error: "Access denied: Only admin accounts can send promotional emails." });
      }
      const subject = String(body.subject || "").trim();
      const textBody = String(body.body || body.message || "").trim();
      const targetMode = String(body.target || "ALL").trim().toUpperCase();
      const ctaText = String(body.ctaText || "").trim();
      const ctaUrl = String(body.ctaUrl || "").trim();

      if (subject.length < 3 || subject.length > 160) {
        return res.status(400).json({ error: "Email subject must be between 3 and 160 characters." });
      }
      if (textBody.length < 5 || textBody.length > 5000) {
        return res.status(400).json({ error: "Email message must be between 5 and 5000 characters." });
      }

      const recipientSet = new Set();
      if (targetMode === "CUSTOM") {
        const rawList = String(body.customEmails || "")
          .split(/[\s,;]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        for (const item of rawList) {
          if (EMAIL_REGEX.test(item)) recipientSet.add(item);
        }
      } else {
        const usersResult = await getCustomerUsers({ limit: 500 });
        for (const u of usersResult.users || []) {
          const em = String(u.email || "").trim().toLowerCase();
          if (EMAIL_REGEX.test(em)) recipientSet.add(em);
        }
      }

      const recipients = Array.from(recipientSet);
      if (recipients.length === 0) {
        return res.status(400).json({
          error:
            targetMode === "CUSTOM"
              ? "Enter at least one valid recipient email address."
              : "No registered customers with a valid email address were found yet.",
        });
      }

      const dispatch = await dispatchPromoEmails({
        recipients,
        subject,
        textBody,
        ctaText,
        ctaUrl,
      });

      const saved = await savePromotionalEmail({
        sender: postAuth.username,
        subject,
        body: textBody,
        ctaText,
        ctaUrl,
        recipientMode: targetMode,
        recipientCount: recipients.length,
        sentCount: dispatch.sentCount,
        failedCount: dispatch.failedCount,
        provider: dispatch.provider,
        recipients,
      });

      return res.status(200).json({
        success: true,
        provider: dispatch.provider,
        recipientCount: recipients.length,
        sentCount: dispatch.sentCount,
        failedCount: dispatch.failedCount,
        recipients,
        errors: dispatch.errors,
        campaign: saved.campaign,
        notice:
          dispatch.provider === "preview_log"
            ? "Campaign logged (no external email provider key configured). Set RESEND_API_KEY, BREVO_API_KEY, or SENDGRID_API_KEY and PROMO_FROM_EMAIL in Vercel to deliver live emails."
            : `Delivered ${dispatch.sentCount} of ${recipients.length} promotional email(s) via ${dispatch.provider}.`,
      });
    }

    // Default POST: Login / verify 14-character alphanumeric username + password
    const username = String(body.username || "").trim();
    const password = String(body.password || "").trim();

    const result = authenticateCredentials(username, password);
    if (result && result.invalidFormat) {
      return res.status(400).json({
        error: "Username and password must each be exactly 14 alphanumeric characters (letters and numbers).",
      });
    }
    if (!result) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = issueSessionToken(result.username, result.role);
    return res.status(200).json({
      authenticated: true,
      username: result.username,
      role: result.role,
      permissions: getPermissionsForRole(result.role),
      token,
    });
  }

  const auth = resolveAuthFromRequest(req);
  if (!auth) {
    return res.status(401).json({ error: "Unauthorized. Valid username and password session required." });
  }

  // PATCH: Change order status, payment status, or claim a refund token
  if (req.method === "PATCH") {
    const body = parseBody(req);

    if (body.action === "claim_refund" || body.action === "verify_refund") {
      const token = String(body.token || "").trim().toUpperCase();
      if (!token || token.length !== 15) {
        return res.status(400).json({ error: "Valid 15-character refund token is required." });
      }
      const claimRes = await claimRefundToken(token, auth.username);
      if (claimRes.error) {
        return res.status(400).json({ error: claimRes.error });
      }
      return res.status(200).json({
        claimed: true,
        token: claimRes.token,
        record: claimRes.record,
      });
    }

    const { orderId, status, paymentStatus } = body;
    if (!orderId || (!status && !paymentStatus)) {
      return res.status(400).json({ error: "orderId and status or paymentStatus are required." });
    }

    if (status) {
      if (auth.role === "driver") {
        if (!DRIVER_ALLOWED_STATUSES.includes(status)) {
          return res.status(403).json({
            error: "Access denied: Driver accounts are only allowed to update delivery status to 'out_for_delivery' or 'completed'.",
          });
        }
      } else if (auth.role !== "admin" && !STAFF_ALLOWED_STATUSES.includes(status)) {
        return res.status(403).json({
          error: "Access denied: Regular user accounts are only allowed to change operational order state (confirmed, preparing, out_for_delivery, ready, completed).",
        });
      }

      if (!ORDER_STATUSES.includes(status)) {
        return res.status(400).json({ error: "Invalid order status." });
      }
    }

    if (paymentStatus) {
      const validPayments = ["pending", "paid", "received", "unpaid"];
      if (!validPayments.includes(String(paymentStatus).toLowerCase())) {
        return res.status(400).json({ error: "Invalid paymentStatus. Allowed: pending, paid, received, unpaid." });
      }
    }

    const updateResult = await updateOrderStatus(orderId, status, paymentStatus);
    if (updateResult.error) {
      return res.status(400).json({ error: updateResult.error });
    }
    if (status) {
      try {
        const { updateCachedOrderStatus } = require("./track");
        if (typeof updateCachedOrderStatus === "function") {
          updateCachedOrderStatus(orderId, status);
        }
      } catch (_) {}
    }
    let refundInfo = null;
    if (status === "cancelled" && (body.issueRefundToken || auth.role === "admin")) {
      try {
        const existingOrder = await findOrderById(orderId);
        let refundedAmount = Number(existingOrder?.grand_total ?? existingOrder?.grandTotal ?? body.refundedAmount ?? body.amount ?? 0);
        if (!refundedAmount && existingOrder?.items) {
          const matches = Array.from(String(existingOrder.items).matchAll(/₦([\d,]+)/g));
          if (matches.length > 0) {
            const subtotal = matches.reduce((sum, m) => sum + Number(m[1].replace(/,/g, "")), 0);
            const serviceFee = Number(existingOrder.service_fee ?? 800);
            const deliveryFee = (existingOrder.fulfilment || "Delivery") === "Delivery" ? Math.round(subtotal * 0.15) : 0;
            refundedAmount = subtotal + serviceFee + deliveryFee;
          }
        }
        if (!refundedAmount) refundedAmount = 0;
        const refundToken = generate15CharRefundToken();
        const issuedAt = new Date().toISOString();
        const customerName = existingOrder?.customer_name || existingOrder?.customerName || body.customerName || "Customer";
        const customerPhone = existingOrder?.customer_phone || existingOrder?.customerPhone || body.customerPhone || "";
        await saveRefundToken({
          token: refundToken,
          order_id: orderId,
          customer_name: customerName,
          customer_phone: customerPhone,
          amount: refundedAmount,
          reason: body.reason || "Order Cancellation",
          issued_by: auth.username,
          issued_at: issuedAt,
          status: "unclaimed",
        });
        refundInfo = {
          refundToken,
          token: refundToken,
          refundedAmount,
          customerName,
          issuedAt,
        };
      } catch (_) {}
    }

    return res.status(200).json({
      success: true,
      orderId,
      status: status || undefined,
      paymentStatus: paymentStatus ? (String(paymentStatus).toLowerCase() === "received" ? "paid" : String(paymentStatus).toLowerCase()) : undefined,
      updatedBy: auth.username,
      role: auth.role,
      ...(refundInfo || {}),
    });
  }

  // DELETE: Strictly restricted to Admin -> Delete used refund tokens OR delete order & issue 15-char refund token
  if (req.method === "DELETE") {
    if (auth.role !== "admin") {
      return res.status(403).json({ error: "Access denied: Only admin accounts can delete orders or refund tokens." });
    }
    const body = parseBody(req);

    if (body.deleteUsedTokens === true || req.query?.deleteUsedTokens === "true") {
      const bulkRes = await deleteClaimedRefundTokens();
      return res.status(200).json({
        deleted: true,
        deleteUsedTokens: true,
        deletedCount: bulkRes.deletedCount || 0,
      });
    }

    const refundTokenToDelete = body.refundToken || req.query?.refundToken;
    if (refundTokenToDelete) {
      const tokRes = await deleteRefundToken(refundTokenToDelete);
      if (tokRes.error) {
        return res.status(400).json({ error: tokRes.error });
      }
      return res.status(200).json({
        deleted: true,
        refundToken: tokRes.token,
      });
    }

    const customerUsernameToDelete = body.customerUsername || req.query?.customerUsername;
    if (customerUsernameToDelete) {
      const userRes = await deleteCustomerUser(customerUsernameToDelete);
      if (userRes.error) {
        return res.status(404).json({ error: userRes.error });
      }
      return res.status(200).json({
        deleted: true,
        customerUsername: userRes.username,
      });
    }

    const feedbackIdToDelete = body.feedbackId ?? req.query?.feedbackId;
    const feedbackCreatedAt = body.createdAt || req.query?.createdAt || "";
    if ((feedbackIdToDelete !== undefined && String(feedbackIdToDelete).trim() !== "") || feedbackCreatedAt) {
      const fbRes = await deleteFeedback({ id: feedbackIdToDelete, createdAt: feedbackCreatedAt });
      if (fbRes.error) {
        return res.status(400).json({ error: fbRes.error });
      }
      return res.status(200).json({
        deleted: true,
        feedbackId: feedbackIdToDelete ?? null,
      });
    }

    const orderId = body.orderId || req.query?.orderId;
    if (!orderId) {
      return res.status(400).json({ error: "orderId is required." });
    }

    // Lookup existing order to record exact refund amount & customer details
    const existingOrder = await findOrderById(orderId);

    let refundedAmount = Number(existingOrder?.grand_total ?? existingOrder?.grandTotal ?? body.refundedAmount ?? body.amount ?? 0);
    if (!refundedAmount && existingOrder?.items) {
      const matches = Array.from(String(existingOrder.items).matchAll(/₦([\d,]+)/g));
      if (matches.length > 0) {
        const subtotal = matches.reduce((sum, m) => sum + Number(m[1].replace(/,/g, "")), 0);
        const serviceFee = Number(existingOrder.service_fee ?? 800);
        const deliveryFee = (existingOrder.fulfilment || "Delivery") === "Delivery" ? Math.round(subtotal * 0.15) : 0;
        refundedAmount = subtotal + serviceFee + deliveryFee;
      }
    }
    if (!refundedAmount) refundedAmount = 0;

    const delResult = await deleteOrder(orderId);
    if (delResult.error) {
      return res.status(400).json({ error: delResult.error });
    }

    // Generate 15-character uppercase alphanumeric refund token
    const refundToken = generate15CharRefundToken();
    const issuedAt = new Date().toISOString();
    const customerName = existingOrder?.customer_name || existingOrder?.customerName || body.customerName || "Customer";
    const customerPhone = existingOrder?.customer_phone || existingOrder?.customerPhone || body.customerPhone || "";
    const reason = body.reason || "Order Deleted by Admin";

    await saveRefundToken({
      token: refundToken,
      order_id: orderId,
      order_pin: existingOrder?.order_pin || existingOrder?.orderPin || body.orderPin || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      amount: refundedAmount,
      reason,
      issued_by: auth.username,
      issued_at: issuedAt,
      status: "unclaimed",
    });

    return res.status(200).json({
      deleted: true,
      orderId,
      refundToken,
      token: refundToken,
      refundedAmount,
      customerName,
      issuedAt,
    });
  }

  // Record live active visitor hit
  recordVisitorHit(req.headers?.["x-forwarded-for"] || req.socket?.remoteAddress || auth?.username);

  // GET: Verify Refund Token
  if (req.query?.verifyRefundToken) {
    const token = String(req.query.verifyRefundToken).trim().toUpperCase();
    const rec = await findRefundToken(token);
    if (!rec) {
      return res.status(404).json({ valid: false, error: "Refund token not found." });
    }
    return res.status(200).json({
      valid: true,
      verified: true,
      token: rec.token,
      refundToken: rec.token,
      orderId: rec.order_id,
      customerName: rec.customer_name,
      customerPhone: rec.customer_phone,
      refundedAmount: Number(rec.amount),
      amount: Number(rec.amount),
      reason: rec.reason,
      issuedBy: rec.issued_by,
      issuedAt: rec.issued_at,
      status: rec.status,
      claimedAt: rec.claimed_at,
      checkedIn: rec.status === "claimed",
    });
  }

  // GET: Refund Tokens Tab data
  if (req.query?.tab === "refunds" || req.query?.view === "refunds" || req.query?.refundTokens === "true") {
    const limit = Math.min(Number(req.query?.limit) || 50, 200);
    const offset = Math.max(Number(req.query?.offset) || 0, 0);
    const status = req.query?.status || null;
    const result = await getRefundTokens({ limit, offset, status });
    return res.status(200).json({
      tokens: result.tokens || [],
      count: result.count || 0,
      provider: result.provider,
      activeVisitors: getActiveVisitorCount(),
    });
  }

  // GET: Customer Feedback Tab data
  if (req.query?.tab === "feedback" || req.query?.view === "feedback") {
    const limit = Math.min(Number(req.query?.limit) || 50, 200);
    const offset = Math.max(Number(req.query?.offset) || 0, 0);
    const result = await getFeedback({ limit, offset });
    return res.status(200).json({
      feedback: result.feedback || [],
      count: result.feedback?.length || 0,
      provider: result.provider,
      activeVisitors: getActiveVisitorCount(),
    });
  }

  // GET: Signed-In & Active Customer Accounts + Sent Messages (Admin Only)
  if (req.query?.tab === "users" || req.query?.view === "users") {
    if (auth.role !== "admin") {
      return res.status(403).json({ error: "Access denied: Only admin accounts can view signed-in customer accounts." });
    }
    const limit = Math.min(Number(req.query?.limit) || 100, 300);
    const [result, messages, promoEmails] = await Promise.all([
      getCustomerUsers({ limit }),
      getAllCustomerMessages({ limit: 30 }),
      getPromotionalEmails({ limit: 20 }),
    ]);
    return res.status(200).json({
      users: result.users || [],
      totalSignedIn: result.totalSignedIn || 0,
      activeSignedIn: result.activeSignedIn || 0,
      messages: messages || [],
      promoEmails: promoEmails || [],
      provider: result.provider,
      activeVisitors: getActiveVisitorCount(),
    });
  }

  // GET: Fetch orders (Staff sees masked operational view; Driver sees active delivery orders with unmasked address/phone and masked email; Admin sees full details)
  const limit = Math.min(Number(req.query?.limit) || 100, 500);
  const offset = Math.max(Number(req.query?.offset) || 0, 0);

  const [result, usersSummary] = await Promise.all([
    getOrders({ limit, offset }),
    auth.role === "admin" ? getCustomerUsers({ limit: 100 }).catch(() => null) : Promise.resolve(null),
  ]);
  const rawOrders = Array.isArray(result.orders) ? result.orders : [];
  let orders;
  if (auth.role === "admin") {
    orders = rawOrders;
  } else if (auth.role === "driver") {
    orders = rawOrders
      .filter((o) => String(o.fulfilment || "").toLowerCase() === "delivery")
      .map(sanitizeOrderForDriver);
  } else {
    orders = rawOrders.map(sanitizeOrderForStaff);
  }

  return res.status(200).json({
    orders,
    count: orders.length,
    limit,
    offset,
    role: auth.role,
    username: auth.username,
    permissions: getPermissionsForRole(auth.role),
    provider: result.provider || "local",
    activeVisitors: auth.role === "admin" ? getActiveVisitorCount() : undefined,
    totalSignedIn: usersSummary ? usersSummary.totalSignedIn : undefined,
    activeSignedIn: usersSummary ? usersSummary.activeSignedIn : undefined,
  });
};

module.exports.CREDENTIAL_REGEX = CREDENTIAL_REGEX;
module.exports.STAFF_ALLOWED_STATUSES = STAFF_ALLOWED_STATUSES;
module.exports.DRIVER_ALLOWED_STATUSES = DRIVER_ALLOWED_STATUSES;
module.exports.DEFAULT_ADMIN_USER_SHA256 = DEFAULT_ADMIN_USER_SHA256;
module.exports.DEFAULT_ADMIN_PASS_SHA256 = DEFAULT_ADMIN_PASS_SHA256;
module.exports.DEFAULT_STAFF_USER_SHA256 = DEFAULT_STAFF_USER_SHA256;
module.exports.DEFAULT_STAFF_PASS_SHA256 = DEFAULT_STAFF_PASS_SHA256;
module.exports.DEFAULT_DRIVER_USER_SHA256 = DEFAULT_DRIVER_USER_SHA256;
module.exports.DEFAULT_DRIVER_PASS_SHA256 = DEFAULT_DRIVER_PASS_SHA256;
module.exports.authenticateCredentials = authenticateCredentials;
module.exports.issueSessionToken = issueSessionToken;
module.exports.verifySessionToken = verifySessionToken;
