import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class CryptService {
  generateKeys() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('x25519', {
      privateKeyEncoding: { format: 'der', type: 'pkcs8' },
      publicKeyEncoding: { format: 'der', type: 'spki' },
    });

    const rawPrivateKey = privateKey.subarray(privateKey.length - 32);
    const rawPublicKey = publicKey.subarray(publicKey.length - 32);

    return {
      private: rawPrivateKey.toString('base64'),
      public: rawPublicKey.toString('base64'),
    };
  }
}
