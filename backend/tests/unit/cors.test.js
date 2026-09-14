const { isOriginAllowed } = require("../../src/config/cors");

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("isOriginAllowed — production", () => {
  it("allows only exact allowlist matches", () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_URL = "https://app.example.com";
    expect(isOriginAllowed("https://app.example.com")).toBe(true);
    expect(isOriginAllowed("https://evil.example.com")).toBe(false);
    expect(isOriginAllowed("http://app.example.com")).toBe(false);
  });

  it("rejects private-network origins in production", () => {
    process.env.NODE_ENV = "production";
    process.env.CLIENT_URL = "https://app.example.com";
    expect(isOriginAllowed("http://192.168.1.5:5173")).toBe(false);
  });
});

describe("isOriginAllowed — development", () => {
  it("allows localhost and RFC-1918 hosts on :5173", () => {
    process.env.NODE_ENV = "development";
    delete process.env.CLIENT_URL;
    delete process.env.FRONTEND_URL;
    expect(isOriginAllowed("http://localhost:5173")).toBe(true);
    expect(isOriginAllowed("http://192.168.1.20:5173")).toBe(true);
    expect(isOriginAllowed("http://10.0.0.4:5173")).toBe(true);
    expect(isOriginAllowed("http://172.16.9.9:5173")).toBe(true);
  });

  it("rejects non-5173 ports and public hosts in dev", () => {
    process.env.NODE_ENV = "development";
    expect(isOriginAllowed("http://192.168.1.20:3000")).toBe(false);
    expect(isOriginAllowed("http://8.8.8.8:5173")).toBe(false);
    expect(isOriginAllowed("not-a-url")).toBe(false);
  });

  it("allows requests with no origin (curl, same-origin)", () => {
    expect(isOriginAllowed(undefined)).toBe(true);
  });
});
