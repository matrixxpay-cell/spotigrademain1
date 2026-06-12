const mongoose = require("mongoose");

const keySchema = new mongoose.Schema({
  key:             { type: String, required: true, unique: true },
  status:          { type: String, default: "available" },
  usedFor:         { type: String, default: null },
  usedByEmail:     { type: String, default: null },
  usedByUsername:  { type: String, default: null },
  country:         { type: String, default: null },
  plan:            { type: String, default: null },
  address:         { type: String, default: null },
  upgradeType:     { type: String, default: null },
  purchaseDate:    { type: Date, default: Date.now },
  usedDate:        { type: Date, default: null },
  cooldownUntil:   { type: Date, default: null },
}, { timestamps: true });

const upgradeRequestSchema = new mongoose.Schema({
  key:               { type: String, required: true },
  email:             { type: String, required: true },
  country:           { type: String, default: null },
  status:            { type: String, default: "pending" },
  confirmedUsername: { type: String, default: null },
  upgradeType:       { type: String, default: null },
  plan:              { type: String, default: null },
  duration:          { type: String, default: null },
  address:           { type: String, default: null },
  countryUpgraded:   { type: String, default: null },
  adminNote:         { type: String, default: null },
}, { timestamps: true });

const renewRequestSchema = new mongoose.Schema({
  key:               { type: String, required: true },
  oldEmail:          { type: String, required: true },
  newEmail:          { type: String, default: null },
  country:           { type: String, default: null },
  files:             { type: [String], default: [] },
  status:            { type: String, default: "pending" },
  proofStatus:       { type: String, default: null },
  confirmedUsername: { type: String, default: null },
  adminNote:         { type: String, default: null },
}, { timestamps: true });

const Key            = mongoose.model("Key", keySchema);
const UpgradeRequest = mongoose.model("UpgradeRequest", upgradeRequestSchema);
const RenewRequest   = mongoose.model("RenewRequest", renewRequestSchema);

module.exports = { Key, UpgradeRequest, RenewRequest };
