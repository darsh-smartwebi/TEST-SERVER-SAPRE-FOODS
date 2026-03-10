import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/fmcg_voice_ai";

/* -------------------- MongoDB -------------------- */
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

/* -------------------- Schemas -------------------- */
const customerSchema = new mongoose.Schema(
  {
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    shopName: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

customerSchema.index({ phone: 1 });

const productPriceSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    product: {
      type: String,
      required: true,
      trim: true,
    },
    packetSize: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

productPriceSchema.index({ customerId: 1, product: 1, packetSize: 1 });

const Customer = mongoose.model("Customer", customerSchema);
const ProductPrice = mongoose.model("ProductPrice", productPriceSchema);

/* -------------------- Helpers -------------------- */
function normalizeText(value = "") {
  return String(value).trim().toLowerCase();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* -------------------- Health -------------------- */
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "FMCG pricing server is running",
  });
});

/* -------------------- Seed test data -------------------- */
app.post("/api/seed", async (req, res) => {
  try {
    await Customer.deleteMany({});
    await ProductPrice.deleteMany({});

    const customers = await Customer.insertMany([
      {
        customerName: "Shree Ram Traders",
        phone: "9876543210",
        shopName: "Shree Ram Traders Surat",
      },
      {
        customerName: "Mahadev Distributors",
        phone: "9988776655",
        shopName: "Mahadev Distributors Navsari",
      },
      {
        customerName: "Balaji Provision Store",
        phone: "9123456780",
        shopName: "Balaji Provision Store Vapi",
      },
    ]);

    const [c1, c2, c3] = customers;

    await ProductPrice.insertMany([
      {
        customerId: c1._id,
        product: "Turmeric Packet",
        packetSize: "1kg",
        price: 120,
      },
      {
        customerId: c1._id,
        product: "Turmeric Packet",
        packetSize: "500g",
        price: 65,
      },
      {
        customerId: c1._id,
        product: "Chilli Powder",
        packetSize: "500g",
        price: 95,
      },
      {
        customerId: c1._id,
        product: "Coriander Powder",
        packetSize: "1kg",
        price: 140,
      },
      {
        customerId: c2._id,
        product: "Turmeric Packet",
        packetSize: "1kg",
        price: 118,
      },
      {
        customerId: c2._id,
        product: "Turmeric Packet",
        packetSize: "500g",
        price: 63,
      },
      {
        customerId: c2._id,
        product: "Chilli Powder",
        packetSize: "500g",
        price: 92,
      },
      {
        customerId: c3._id,
        product: "Turmeric Packet",
        packetSize: "1kg",
        price: 125,
      },
      {
        customerId: c3._id,
        product: "Chilli Powder",
        packetSize: "500g",
        price: 98,
      },
    ]);

    res.json({
      success: true,
      message: "Sample data inserted successfully",
      customers,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to seed data",
      error: err.message,
    });
  }
});

/* -------------------- Add customer manually -------------------- */
app.post("/api/customers", async (req, res) => {
  try {
    const { customerName, phone, shopName, isActive } = req.body;

    if (!customerName || !phone) {
      return res.status(400).json({
        success: false,
        message: "customerName and phone are required",
      });
    }

    const customer = await Customer.create({
      customerName,
      phone: String(phone).trim(),
      shopName,
      isActive,
    });

    res.status(201).json({
      success: true,
      customer,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: err.message,
    });
  }
});

/* -------------------- Add price manually -------------------- */
app.post("/api/prices", async (req, res) => {
  try {
    const { customerId, product, packetSize, price, currency, isActive } =
      req.body;

    if (!customerId || !product || !packetSize || price === undefined) {
      return res.status(400).json({
        success: false,
        message: "customerId, product, packetSize and price are required",
      });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    const priceRow = await ProductPrice.create({
      customerId,
      product,
      packetSize,
      price,
      currency,
      isActive,
    });

    res.status(201).json({
      success: true,
      priceRow,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to create price row",
      error: err.message,
    });
  }
});

/* -------------------- Verify customer by phone -------------------- */
app.post("/api/verify-customer", async (req, res) => {
  try {
    const phone = req.body.phone || req.query.phone;

    if (!phone) {
      return res.status(400).json({
        verified: false,
        message: "phone is required",
      });
    }

    const customer = await Customer.findOne({
      phone: String(phone).trim(),
      isActive: true,
    }).lean();

    if (!customer) {
      return res.json({
        verified: false,
        message: "Customer not found",
      });
    }

    res.json({
      verified: true,
      customerId: customer._id,
      customerName: customer.customerName,
      phone: customer.phone,
      shopName: customer.shopName,
      message: "Customer verified successfully",
    });
  } catch (err) {
    res.status(500).json({
      verified: false,
      message: "Server error",
      error: err.message,
    });
  }
});
/* -------------------- Main API: get price by phone + product + packetSize -------------------- */
app.post("/api/check-price", async (req, res) => {
  try {
    const phone = req.body.phone || req.query.phone;
    const product = req.body.product || req.query.product;
    const packetSize = req.body.packetSize || req.query.packetSize;

    if (!phone || !product || !packetSize) {
      return res.status(400).json({
        success: false,
        answerText: "Phone number, product, and packet size are required.",
      });
    }

    const customer = await Customer.findOne({
      phone: String(phone).trim(),
      isActive: true,
    }).lean();

    if (!customer) {
      return res.json({
        success: false,
        verified: false,
        answerText: "I could not verify your registered mobile number.",
      });
    }

    const exactMatch = await ProductPrice.findOne({
      customerId: customer._id,
      product: { $regex: new RegExp(`^${escapeRegex(product)}$`, "i") },
      packetSize: { $regex: new RegExp(`^${escapeRegex(packetSize)}$`, "i") },
      isActive: true,
    }).lean();

    if (exactMatch) {
      return res.json({
        success: true,
        verified: true,
        answerText: `The price of ${exactMatch.product} ${exactMatch.packetSize} is ${exactMatch.price} rupees.`,
      });
    }

    const allPrices = await ProductPrice.find({
      customerId: customer._id,
      isActive: true,
    }).lean();

    const matched = allPrices.find(
      (item) =>
        normalizeText(item.product).includes(normalizeText(product)) &&
        normalizeText(item.packetSize) === normalizeText(packetSize),
    );

    if (!matched) {
      return res.json({
        success: false,
        verified: true,
        answerText:
          "I could not find the price for that product and packet size.",
      });
    }

    return res.json({
      success: true,
      verified: true,
      answerText: `The price of ${matched.product} ${matched.packetSize} is ${matched.price} rupees.`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      answerText: "There was a server issue while checking the price.",
    });
  }
});

/* -------------------- List data -------------------- */
app.get("/api/customers", async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/prices", async (req, res) => {
  try {
    const prices = await ProductPrice.find()
      .populate("customerId", "customerName phone shopName")
      .sort({ createdAt: -1 });

    res.json({ success: true, prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* -------------------- Start server -------------------- */
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
