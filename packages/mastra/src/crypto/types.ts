export type EncryptedPayload = {
    __enc: "v1";
    iv: string;
    tag: string;
    data: string;
};

export type Ed25519KeyPair = {
    publicKey: string; // base64-encoded
    privateKey: string; // base64-encoded (plaintext, before encryption)
};

export type EncryptedKeyPair = {
    publicKey: string; // base64-encoded
    encryptedPrivateKey: EncryptedPayload;
};

export type SignedPayload = {
    payload: string; // the original content
    signature: string; // base64-encoded Ed25519 signature
    signerPublicKey: string; // base64-encoded public key of signer
    keyVersion: number;
};
