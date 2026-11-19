// Automated End-to-End Test Suite for Customer Password Reset Feature
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const authHandler = require("../api/auth.js");

function createMockReqRes({ method = "POST", body = {}, headers = {}, cookies = {} }) {
  const req = {
    method,
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    body,
    socket: { remoteAddress: "127.0.0.1" },
  };

  if (Object.keys(cookies).length > 0) {
    req.headers.cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("; ");
  }

  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(name, val) {
      this.headers[name.toLowerCase()] = val;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    end() {
      return this;
    },
  };

  return { req, res };
}

async function run() {
  console.log("=== Testing Password Reset Feature ===");

  // 1. Verify login.html markup
  const loginHtmlPath = path.join(__dirname, "../login.html");
  const loginHtml = fs.readFileSync(loginHtmlPath, "utf8");

  assert(loginHtml.includes('id="tab-reset"'), "login.html must have #tab-reset tab");
  assert(loginHtml.includes('id="forgot-password-link"'), "login.html must have #forgot-password-link");
  assert(loginHtml.includes('id="reset-form"'), "login.html must have #reset-form");
  assert(loginHtml.includes('id="reset-username"'), "login.html must have #reset-username input");
  assert(loginHtml.includes('id="reset-contact"'), "login.html must have #reset-contact input");
  assert(loginHtml.includes('id="reset-password"'), "login.html must have #reset-password input");
  assert(loginHtml.includes('id="reset-confirm-password"'), "login.html must have #reset-confirm-password input");
  assert(loginHtml.includes('id="reset-submit-btn"'), "login.html must have #reset-submit-btn");
  assert(loginHtml.includes('id="reset-back-signin"'), "login.html must have #reset-back-signin");
  console.log("  [PASS] 1. login.html markup contains all Password Reset UI components");

  // 2. Register a unique test user
  const testUser = `pwuser_${Date.now().toString(36)}`;
  const initialPassword = "InitialPassword123!";
  const testEmail = `${testUser}@coldberry.ng`;
  const testPhone = "08098765432";

  {
    const { req, res } = createMockReqRes({
      body: {
        action: "register",
        username: testUser,
        password: initialPassword,
        fullName: "Reset Test Customer",
        email: testEmail,
        phone: testPhone,
        consent: true,
      },
    });
    await authHandler(req, res);
    assert.strictEqual(res.statusCode, 201, `Registration should return 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    assert.strictEqual(res.body.success, true);
    console.log(`  [PASS] 2. Test user "${testUser}" registered successfully`);
  }

  // 3. Test validation errors on reset
  {
    // Missing username
    const { req, res } = createMockReqRes({
      body: { action: "reset_password", verifyContact: testEmail, newPassword: "NewSecurePassword456!" },
    });
    await authHandler(req, res);
    assert.strictEqual(res.statusCode, 400);
    assert(res.body.error.includes("Username is required"));

    // Missing contact
    const { req: req2, res: res2 } = createMockReqRes({
      body: { action: "reset_password", username: testUser, newPassword: "NewSecurePassword456!" },
    });
    await authHandler(req2, res2);
    assert.strictEqual(res2.statusCode, 400);
    assert(res2.body.error.includes("contact") || res2.body.error.includes("email"));

    // Short password
    const { req: req3, res: res3 } = createMockReqRes({
      body: { action: "reset_password", username: testUser, verifyContact: testEmail, newPassword: "short" },
    });
    await authHandler(req3, res3);
    assert.strictEqual(res3.statusCode, 400);
    assert(res3.body.error.includes("8 characters"));

    // Unknown username
    const { req: req4, res: res4 } = createMockReqRes({
      body: { action: "reset_password", username: "non_existent_user_999", verifyContact: testEmail, newPassword: "NewSecurePassword456!" },
    });
    await authHandler(req4, res4);
    assert.strictEqual(res4.statusCode, 404);

    // Mismatched contact (wrong email/phone)
    const { req: req5, res: res5 } = createMockReqRes({
      body: { action: "reset_password", username: testUser, verifyContact: "wrong_email@other.com", newPassword: "NewSecurePassword456!" },
    });
    await authHandler(req5, res5);
    assert.strictEqual(res5.statusCode, 403);
    assert(res5.body.error.includes("Verification failed"));
  }
  console.log("  [PASS] 3. Validation checks enforce required fields, password length, and identity match (400, 404, 403)");

  // 4. Perform valid password reset via Email
  const passwordV2 = "SecondPassword2026!";
  {
    const { req, res } = createMockReqRes({
      body: {
        action: "reset_password",
        username: testUser,
        verifyContact: testEmail,
        newPassword: passwordV2,
      },
    });
    await authHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);
    console.log("  [PASS] 4. Password reset succeeded via verified email");
  }

  // 5. Verify old password fails and new password succeeds
  {
    // Old password must fail
    const { req: failReq, res: failRes } = createMockReqRes({
      body: { action: "login", username: testUser, password: initialPassword },
    });
    await authHandler(failReq, failRes);
    assert.strictEqual(failRes.statusCode, 401, "Old password must be rejected");

    // New password must succeed
    const { req: okReq, res: okRes } = createMockReqRes({
      body: { action: "login", username: testUser, password: passwordV2 },
    });
    await authHandler(okReq, okRes);
    assert.strictEqual(okRes.statusCode, 200, "New password must authenticate");
    assert.strictEqual(okRes.body.authenticated, true);
    console.log("  [PASS] 5. Old password rejected (401), new password authenticated (200)");
  }

  // 6. Perform valid password reset via Phone
  const passwordV3 = "ThirdPassword2026#";
  {
    const { req, res } = createMockReqRes({
      body: {
        action: "reset_password",
        username: testUser,
        verifyContact: testPhone,
        newPassword: passwordV3,
      },
    });
    await authHandler(req, res);
    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.body.success, true);

    // Verify authentication with passwordV3
    const { req: okReq, res: okRes } = createMockReqRes({
      body: { action: "login", username: testUser, password: passwordV3 },
    });
    await authHandler(okReq, okRes);
    assert.strictEqual(okRes.statusCode, 200);
    assert.strictEqual(okRes.body.authenticated, true);
    console.log("  [PASS] 6. Password reset succeeded via verified phone number and authenticated");
  }

  console.log("\n=== ALL PASSWORD RESET TESTS PASSED SUCCESSFULLY! ===");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
