import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET ??= "clave-de-pruebas-no-usada-en-produccion";

const { hashPin, verifyPinHash, MIN_PIN_LENGTH } = await import("@/src/lib/pin");
const { issueSession, verifySession } = await import("@/src/lib/session");
const { rateLimit } = await import("@/src/lib/rate-limit");

describe("PIN con scrypt", () => {
  test("acepta el PIN correcto y rechaza el resto", () => {
    const hash = hashPin("482913");
    assert.equal(verifyPinHash("482913", hash), true);
    assert.equal(verifyPinHash("482914", hash), false);
    assert.equal(verifyPinHash("", hash), false);
  });

  test("el mismo PIN produce hashes distintos (sal por PIN)", () => {
    assert.notEqual(hashPin("1234"), hashPin("1234"));
  });

  test("un hash corrupto no revienta, devuelve false", () => {
    assert.equal(verifyPinHash("1234", "no-es-un-hash"), false);
    assert.equal(verifyPinHash("1234", "scrypt$16384$8$1$sal"), false);
  });

  test("el mínimo son 6 dígitos", () => {
    assert.equal(MIN_PIN_LENGTH, 6);
  });
});

describe("Sesión firmada", () => {
  test("ida y vuelta conserva el rol", () => {
    const t = issueSession({ sub: "superadmin", role: "superadmin", name: "Marco" });
    assert.equal(verifySession(t)?.role, "superadmin");
  });

  test("rechaza una firma inventada — no hay escalada de rol", () => {
    const payload = Buffer.from(JSON.stringify({
      sub: "x", role: "superadmin", name: "intruso", exp: 9e9,
    })).toString("base64url");
    assert.equal(verifySession(`${payload}.firmafalsa`), null);
  });

  test("rechaza el payload manipulado aunque la firma sea real", () => {
    const t = issueSession({ sub: "u1", role: "collaborator", name: "Lidette" });
    const [data, sig] = t.split(".");
    const otro = Buffer.from(JSON.stringify({
      sub: "u1", role: "superadmin", name: "Lidette", exp: 9e9,
    })).toString("base64url");
    assert.equal(verifySession(`${otro}.${sig}`), null);
    assert.equal(verifySession(`${data}.${sig}`)?.role, "collaborator");
  });

  test("rechaza la sesión expirada", () => {
    assert.equal(verifySession(issueSession({ sub: "u", role: "collaborator", name: "" }, -10)), null);
  });

  test("basura y vacío devuelven null, no excepción", () => {
    assert.equal(verifySession(""), null);
    assert.equal(verifySession("una.dos.tres"), null);
    assert.equal(verifySession(null), null);
  });
});

describe("Límite por IP", () => {
  test("deja pasar hasta el tope y bloquea después", () => {
    const clave = `prueba-${Math.random()}`;
    for (let i = 0; i < 3; i++) assert.equal(rateLimit(clave, 3, 60_000).ok, true);
    const bloqueado = rateLimit(clave, 3, 60_000);
    assert.equal(bloqueado.ok, false);
    assert.ok(bloqueado.retryAfter > 0);
  });

  test("cada clave lleva su propia cuenta", () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`;
    rateLimit(a, 1, 60_000); rateLimit(a, 1, 60_000);
    assert.equal(rateLimit(a, 1, 60_000).ok, false);
    assert.equal(rateLimit(b, 1, 60_000).ok, true);
  });

  test("la ventana se reabre al vencer", () => {
    const clave = `v-${Math.random()}`;
    rateLimit(clave, 1, 1);
    assert.equal(rateLimit(clave, 1, 1).ok, false);
    return new Promise<void>(res => setTimeout(() => {
      assert.equal(rateLimit(clave, 1, 1).ok, true);
      res();
    }, 15));
  });
});
