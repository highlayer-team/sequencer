const cbor = require("cbor");
const { base58 } = require("bstring");

class HighlayerBundle {
  constructor(parentBundle, txids, sequencerSignature) {
    this.parentBundle = parentBundle || "";
    this.txids = txids || [];
    this.sequencerSignature = sequencerSignature || null;
  }

  encode() {
    return base58.encode(
      cbor.encode({
        parentBundle: this.parentBundle,
        txids: this.txids,
        sequencerSignature: this.sequencerSignature,
      })
    );
  }

  static decode(base58encoded) {
    const buffer = base58.decode(base58encoded);
    const decodedObject = cbor.decodeFirstSync(buffer);
    return {
      parentBundle: decodedObject.parentBundle,
      txids: decodedObject.txids,
      sequencerSignature: decodedObject.sequencerSignature,
    };
  }
}

module.exports = { HighlayerBundle };
