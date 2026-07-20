# How-to: wallet payloads (registry types)

This is **not a wallet library.** It receives a UR and hands you bytes. But the biggest UR ecosystem is crypto wallets and air-gapped signers, so here is how the byte layer meets the wallet layer, without this library taking on any wallet dependency.

## Where the boundary is

- **This library** gives you `DecodedUR`: a `type` string (e.g. `crypto-hdkey`, `crypto-psbt`, `crypto-account`) and `cbor`, the raw CBOR body as a `Uint8Array`. It also offers `decodeCbor()`, which CBOR-decodes that body.
- **A registry library** turns that CBOR into a typed wallet object (an HD key, a PSBT, an account descriptor). That is `@ngraveio/ur-registry` or `@keystonehq/bc-ur-registry`, not this package.

Keeping the split means you can receive any UR type, today or future, without waiting on us to add a class for it.

## Filter for the type you expect

If you only want extended public keys, reject everything else at the door:

```ts
import { URReceiver } from '@blocco/ur-scanner';

const rx = new URReceiver({
  expectedType: 'crypto-hdkey',
  onError: (e) => { if (e.code === 'UNEXPECTED_TYPE') toast('Scan a crypto-hdkey QR'); },
  onComplete: (ur) => handleHdKey(ur.cbor),
});
```

`expectedType` also protects against the classic footgun of a user scanning a PSBT where an account was expected.

## Decode the CBOR with a registry lib

```ts
// with @keystonehq/bc-ur-registry (illustrative; check the lib's current API)
import { CryptoHDKey } from '@keystonehq/bc-ur-registry';

function handleHdKey(cbor: Uint8Array) {
  const hdKey = CryptoHDKey.fromCBOR(Buffer.from(cbor));
  console.log(hdKey.getBip32Key());
}
```

The registry library owns the CBOR-to-object mapping and the semantics of each field; this library guarantees only that `cbor` is exactly the bytes the sender put in the UR.

## Common types you might receive

`crypto-hdkey`, `crypto-account`, `crypto-output`, `crypto-psbt`, `crypto-seed`, `bytes`, and vendor extensions. The authoritative lists and decoders live upstream:

- [ngraveio/ur-registry](https://github.com/ngraveio/ur-registry)
- [KeystoneHQ/ur-registry](https://github.com/KeystoneHQ/ur-registry)

## Interop reality check

We do **not** claim hardware-wallet compatibility. Different signers emit slightly different fragment sizes, fps, and (rarely) type spellings. If you verify this library against a Keystone, a Jade, a Passport, or similar, please add a row to the [compatibility matrix](../compat.md). That matrix, not this paragraph, is the source of truth for what actually works.
