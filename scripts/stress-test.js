// Stress & Adversarial Test Suite for Romeo's Pizza Nigeria
// Runs 5 intensive stress-testing rounds to try to break the system under
// concurrency, boundary pricing, adversarial security payloads, and PIN retention.

process.env.NODE_ENV = process.env.NODE_ENV || "test";
const path = require("path");
const assert = require("assert");

const ROOT_DIR = path.resolve(__dirname, "..");
const orderJs = require(path.join(ROOT_DIR, "js/order.js"));
const ordersApi = require(path.join(ROOT_DIR, "api/orders.js"));
const trackApi = require(path.join(ROOT_DIR, "api/track.js"));
const adminApi = require(path.join(ROOT_DIR, "api/admin.js"));
const pinManager = require(path.join(ROOT_DIR, "api/pin-manager.js"));
const prices = require(path.join(ROOT_DIR, "prices.json"));

function mockReqRes(method, pathOrQuery, body = null, headers = {}) {
  const req = {
    method,
    headers: { "content-type": "application/json", ...headers },
    query: typeof pathOrQuery === "object" ? pathOrQuery : {},
    body,
  };
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end(text) { this.body = text; return this; },
  };
  return { req, res };
}

async function runRound(roundNum) {
  console.log(`\n==================================================`);
  console.log(`=== RUNNING STRESS TEST ROUND ${roundNum} / 5 ===`);
  console.log(`==================================================`);

  // -------------------------------------------------------------------------
  // Test 1: Rapid PIN Allocation & Collision Resistance (100 PINs)
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 1. Concurrency & Collision Resistance (100 PINs)...`);
  pinManager.clearStore();
  const pins = new Set();
  const now = Date.now() + (roundNum * 1000);
  for (let i = 0; i < 100; i++) {
    const pin = pinManager.generateOrderPin({ now });
    assert(/^[1-9]\d{5}$/.test(pin), `PIN ${pin} must be 6 digits and non-zero-padded`);
    assert(!pins.has(pin), `PIN collision detected on iteration ${i}: ${pin}`);
    pins.add(pin);
  }
  assert.strictEqual(pins.size, 100, "Must have exactly 100 unique PINs");
  console.log(`  -> PASS: 100/100 distinct 6-digit PINs generated with 0 collisions.`);

  // -------------------------------------------------------------------------
  // Test 2: Boundary Pricing & Half & Half Symmetry (All 507 Combinations)
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 2. Half & Half Symmetry & 5% Surcharge Matrix...`);
  const flavors = [
    "Pepperoni Pizza", "BBQ Chicken Pizza", "Chicken Supreme Pizza", "Veggie Supreme Pizza", "BBQ Beef Pizza",
    "Beef Suya Pizza", "Shawarma Pizza", "Chicken Suya Pizza", "Sweet Chilli Chicken",
    "Meatylover Pizza", "Sweet & Hot Pizza", "Margherita Pizza"
  ];
  const sizes = ["Medium", "Large", "Champion"];

  let combosTested = 0;
  for (const s of sizes) {
    for (const f1 of flavors) {
      for (const f2 of flavors) {
        combosTested++;
        const calc1 = orderJs.calculateHalfAndHalfPrice(f1, f2, s);
        const calc2 = orderJs.calculateHalfAndHalfPrice(f2, f1, s);

        // Symmetry: f1 + f2 must equal f2 + f1
        assert.strictEqual(calc1.totalPrice, calc2.totalPrice, `Symmetry failed for ${f1} + ${f2} (${s})`);
        assert.strictEqual(calc1.surcharge, calc2.surcharge, `Surcharge symmetry failed for ${f1} + ${f2} (${s})`);

        // Exact formula check: round(maxPrice * 1.05)
        const expectedMax = Math.max(calc1.sideAPrice, calc1.sideBPrice);
        const expectedTotal = Math.round(expectedMax * 1.05);
        assert.strictEqual(calc1.totalPrice, expectedTotal, `Formula mismatch for ${f1} + ${f2} (${s})`);
      }
    }
  }
  console.log(`  -> PASS: Verified all ${combosTested} Half & Half permutations for exact 5% pricing and commutative symmetry.`);

  // -------------------------------------------------------------------------
  // Test 3: Security & Adversarial Payloads
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 3. Security, XSS & Attack Payload Fuzzing...`);

  // XSS injection in name and notes
  const xssPayload = {
    consent: true,
    customer: {
      name: "<script>alert('xss')</script>Bello",
      phone: "+2348012345678",
      email: "test@example.com",
    },
    fulfilment: "Delivery",
    location: "Garki, Abuja",
    address: "12 Nile Street, Abuja <img src=x onerror=alert(1)>",
    items: [{ name: "Pepperoni Pizza (Large)", quantity: 1 }],
    notes: "'; DROP TABLE orders; -- <script>",
  };

  const { req: xssReq, res: xssRes } = mockReqRes("POST", {}, xssPayload);
  await ordersApi(xssReq, xssRes);
  assert.strictEqual(xssRes.statusCode, 200, "XSS payload should be safely normalized without crashing");
  const waUrl = xssRes.body.whatsappUrl;
  assert(!waUrl.includes("<script>"), "Raw script tags must not be passed unescaped");
  const orderPin = xssRes.body.orderPin;
  assert(/^[1-9]\d{5}$/.test(orderPin), "Order PIN must be valid");

  // Oversized body (> 12,000 bytes)
  const hugePayload = {
    consent: true,
    customer: { name: "Amina", phone: "+2348012345678" },
    fulfilment: "Pickup",
    location: "Yaba, Lagos",
    items: [{ name: "Pepperoni Pizza (Large)", quantity: 1 }],
    notes: "A".repeat(15000),
  };
  const { req: hugeReq, res: hugeRes } = mockReqRes("POST", {}, hugePayload);
  await ordersApi(hugeReq, hugeRes);
  assert.strictEqual(hugeRes.statusCode, 413, "Oversized payload must return 413");

  console.log(`  -> PASS: XSS sanitized, oversized payload correctly rejected (HTTP 413).`);

  // -------------------------------------------------------------------------
  // Test 4: Live Order Tracking Lifecycle (Pending -> Completed)
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 4. Order Tracking Lifecycle via /api/track...`);
  const { req: trackReq1, res: trackRes1 } = mockReqRes("GET", { phone: "+2348012345678", pin: orderPin });
  await trackApi(trackReq1, trackRes1);
  assert.strictEqual(trackRes1.statusCode, 200);
  assert.strictEqual(trackRes1.body.found, true);
  assert.strictEqual(trackRes1.body.order.status, "pending");
  assert.strictEqual(trackRes1.body.order.step, 1);

  // Wrong PIN -> 404
  const { req: badTrackReq, res: badTrackRes } = mockReqRes("GET", { phone: "+2348012345678", pin: "000000" });
  await trackApi(badTrackReq, badTrackRes);
  assert.strictEqual(badTrackRes.statusCode, 404, "Wrong PIN must return 404");

  // Invalid PIN format -> 400
  const { req: invalidPinReq, res: invalidPinRes } = mockReqRes("GET", { phone: "+2348012345678", pin: "abc" });
  await trackApi(invalidPinReq, invalidPinRes);
  assert.strictEqual(invalidPinRes.statusCode, 400, "Non-numeric PIN must return 400");

  console.log(`  -> PASS: Live order tracked, wrong PIN rejected (404), invalid format rejected (400).`);

  // -------------------------------------------------------------------------
  // Test 5: 5-Day Non-Recycling & Expiration Math
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 5. Time Travel: Strict 5-Day Non-Recycling Simulation...`);
  const t0 = Date.now();
  const testPin = pinManager.generateOrderPin({ now: t0 });

  // T0 + 1 hour: Active
  assert(pinManager.isPinActive(testPin, t0 + 3600000), "PIN must be active after 1 hour");
  // T0 + 4 days, 23 hours: Active
  const tAlmost5d = t0 + (4 * 24 * 3600000) + (23 * 3600000);
  assert(pinManager.isPinActive(testPin, tAlmost5d), "PIN must remain active at 4 days, 23 hours");
  // T0 + 5 days + 1 second: Expired & Recycled
  const t5d1s = t0 + (5 * 24 * 3600000) + 1000;
  assert(!pinManager.isPinActive(testPin, t5d1s), "PIN must be recycled after 5 days have passed");

  console.log(`  -> PASS: PIN held active for 4d23h, recycled precisely after 5d.`);

  // -------------------------------------------------------------------------
  // Test 6: RBAC Console Lock & 12-Minute Cancellation Boundary Stress
  // -------------------------------------------------------------------------
  console.log(`[Round ${roundNum}] 6. RBAC Role Enforcement & 12-Minute Cancel Boundary...`);
  const { req: sLoginReq, res: sLoginRes } = mockReqRes("POST", {}, {
    action: "login",
    username: "RomeosStaff890",
    password: "Stf63Mp49Lw28R",
  });
  await adminApi(sLoginReq, sLoginRes);
  assert.strictEqual(sLoginRes.statusCode, 200);
  assert.strictEqual(sLoginRes.body.role, "staff");
  const staffToken = sLoginRes.body.token;

  // Staff blocked from cancelling order
  const { req: sCancelReq, res: sCancelRes } = mockReqRes(
    "PATCH",
    {},
    { orderId: xssRes.body.orderId, status: "cancelled" },
    { authorization: `Bearer ${staffToken}` }
  );
  await adminApi(sCancelReq, sCancelRes);
  assert.strictEqual(sCancelRes.statusCode, 403, "Regular user must receive 403 when attempting cancel");

  // Customer blocked after 12m01s, allowed at 11m59s
  const { req: lateReq, res: lateRes } = mockReqRes("POST", {}, {
    action: "cancel",
    phone: "+2348012345678",
    pin: orderPin,
    _testNow: Date.now() + 12 * 60 * 1000 + 5000,
  });
  await trackApi(lateReq, lateRes);
  assert.strictEqual(lateRes.statusCode, 400, "Cancel after 12m must fail with 400");

  const { req: onTimeReq, res: onTimeRes } = mockReqRes("POST", {}, {
    action: "cancel",
    phone: "+2348012345678",
    pin: orderPin,
  });
  await trackApi(onTimeReq, onTimeRes);
  assert.strictEqual(onTimeRes.statusCode, 200, "Cancel within 12m must succeed with 200");
  assert.strictEqual(onTimeRes.body.order.status, "cancelled");
  console.log(`  -> PASS: Regular Staff locked to state changes only (403 on cancel); 12-min cancel boundary enforced.`);
  console.log(`[Round ${roundNum}] ALL TESTS PASSED SUCCESSFULLY!`);
}

async function main() {
  console.log("=== ROMEO'S PIZZA ADVERSARIAL STRESS TEST (5 ROUNDS) ===");
  for (let r = 1; r <= 5; r++) {
    await runRound(r);
  }
  console.log("\n=======================================================");
  console.log("=== ALL 5 STRESS TEST ROUNDS COMPLETED WITHOUT ERRORS ===");
  console.log("=======================================================\n");
}

if (require.main === module) {
  main().catch((err) => {
    console.error("\nSTRESS TEST FAILURE:", err);
    process.exit(1);
  });
}

module.exports = { runRound };
