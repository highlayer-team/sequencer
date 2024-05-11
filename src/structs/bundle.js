const msgpackr = require("msgpackr");
const { base58 } = require("bstring");

class HighlayerBundle {
  constructor(parentBundle, txids, sequencerSignature) {
    this.parentBundle = parentBundle || "";
    this.txids = txids || [];
    this.sequencerSignature = sequencerSignature || null;
  }

  encode() {
    return base58.encode(
      msgpackr.encode({
        parentBundle: this.parentBundle,
        txids: this.txids,
        sequencerSignature: this.sequencerSignature,
      })
    );
  }

  static decode(base58encoded) {
    const buffer = base58.decode(base58encoded);
    const decodedObject = msgpackr.decode(buffer);
    return {
      parentBundle: decodedObject.parentBundle,
      txids: decodedObject.txids,
      sequencerSignature: decodedObject.sequencerSignature,
    };
  }
}

module.exports = { HighlayerBundle };
