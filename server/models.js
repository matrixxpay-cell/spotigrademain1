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
  password:          { type: String, default: null },
  country:           { type: String, default: null },
  status:            { type: String, default: "pending" },
  confirmedUsername: { type: String, default: null },
  upgradeType:       { type: String, default: null },
  plan:              { type: String, default: null },
  duration:          { type: String, default: null },
  address:           { type: String, default: null },
  countryUpgraded:   { type: String, default: null },
  adminNote:         { type: String, default: null },
  declineReason:     { type: String, default: null },
  processedBy:       { type: String, default: null }, // maker id
}, { timestamps: true });

const renewRequestSchema = new mongoose.Schema({
  key:               { type: String, required: true },
  oldEmail:          { type: String, required: true },
  oldPassword:       { type: String, default: null },
  newEmail:          { type: String, default: null },
  newPassword:       { type: String, default: null },
  country:           { type: String, default: null },
  files:             { type: [String], default: [] },
  status:            { type: String, default: "pending" },
  proofStatus:       { type: String, default: null },
  confirmedUsername: { type: String, default: null },
  adminNote:         { type: String, default: null },
  declineReason:     { type: String, default: null },
  processedBy:       { type: String, default: null }, // maker id
}, { timestamps: true });

const makerKeySchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true },
  name:      { type: String, default: "Maker" },
  status:    { type: String, default: "active" }, // active / suspended
  earnings:  { type: Number, default: 0 },
}, { timestamps: true });

const payoutSchema = new mongoose.Schema({
  makerId:   { type: mongoose.Schema.Types.ObjectId, ref: "MakerKey", required: true },
  makerName: { type: String, default: "" },
  amount:    { type: Number, required: true },
  method:    { type: String, required: true }, // upi / ltc / usdt_bep20
  address:   { type: String, required: true },
  status:    { type: String, default: "pending" }, // pending / paid / rejected
  txnId:     { type: String, default: null },
  adminNote: { type: String, default: null },
}, { timestamps: true });

const appSettingsSchema = new mongoose.Schema({
  makerRate: { type: Number, default: 0.09 },
  smtpHost:  { type: String, default: "" },
  smtpPort:  { type: Number, default: 587 },
  smtpUser:  { type: String, default: "" },
  smtpPass:  { type: String, default: "" },
  smtpFrom:  { type: String, default: "" },
}, { timestamps: true });

const Key            = mongoose.model("Key", keySchema);
const UpgradeRequest = mongoose.model("UpgradeRequest", upgradeRequestSchema);
const RenewRequest   = mongoose.model("RenewRequest", renewRequestSchema);
const MakerKey       = mongoose.model("MakerKey", makerKeySchema);
const Payout         = mongoose.model("Payout", payoutSchema);
const AppSettings    = mongoose.model("AppSettings", appSettingsSchema);

module.exports = { Key, UpgradeRequest, RenewRequest, MakerKey, Payout, AppSettings };
