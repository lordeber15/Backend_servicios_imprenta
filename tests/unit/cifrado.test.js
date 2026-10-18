const { cifrar, descifrar } = require("../../src/infrastructure/utils/cifrado");

describe("cifrado AES-256-GCM de credenciales", () => {
  test("ida y vuelta con el mismo contexto", () => {
    const c = cifrar("Clave SOL ñ", "emisor:1:clave_sol");
    expect(c.startsWith("v1:")).toBe(true);
    expect(c).not.toContain("Clave");
    expect(descifrar(c, "emisor:1:clave_sol")).toBe("Clave SOL ñ");
  });
  test("mismo texto → cifrados distintos (IV aleatorio)", () => {
    expect(cifrar("x", "ctx")).not.toBe(cifrar("x", "ctx"));
  });
  test("otro contexto (copiado a otra fila o campo) → falla", () => {
    const c = cifrar("secreto", "emisor:1:clave_sol");
    expect(() => descifrar(c, "emisor:2:clave_sol")).toThrow();
    expect(() => descifrar(c, "emisor:1:client_secret")).toThrow();
  });
  test("dato alterado → falla", () => {
    const [v, iv, tag, ct] = cifrar("secreto", "ctx").split(":");
    const otro = Buffer.from(ct, "base64url"); otro[0] ^= 1;
    expect(() => descifrar([v, iv, tag, otro.toString("base64url")].join(":"), "ctx")).toThrow();
  });
  test("sin llave no cifra", () => {
    const k = process.env.DATA_ENCRYPTION_KEY;
    delete process.env.DATA_ENCRYPTION_KEY;
    expect(() => cifrar("x", "ctx")).toThrow(/DATA_ENCRYPTION_KEY/);
    process.env.DATA_ENCRYPTION_KEY = k;
  });
});
