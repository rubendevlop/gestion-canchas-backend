import Product from '../models/Product.js';
import Complex from '../models/Complex.js';
import { assertComplexClientAccess } from '../utils/ownerBilling.js';

const assertOwner = (complex, dbUser) => {
  if (dbUser.role === 'superadmin') return;
  if (complex.ownerId.toString() !== dbUser._id.toString()) {
    const err = new Error('No tenés permiso sobre este complejo.'); err.status = 403; throw err;
  }
};

// POST /api/products
export const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, image, complexId } = req.body;
    const complex = await Complex.findById(complexId);
    if (!complex) return res.status(404).json({ error: 'Complejo no encontrado' });
    assertOwner(complex, req.dbUser);
    const prod = new Product({ name, description, price, stock, category, image, complexId });
    await prod.save();
    res.status(201).json(prod);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Error al crear producto' });
  }
};

// GET /api/products?complexId=X&category=X
export const getProducts = async (req, res) => {
  try {
    const filter = {};
    if (req.query.complexId) filter.complexId = req.query.complexId;
    if (req.query.category)  filter.category  = req.query.category;

    if (req.query.clientVisible === 'true' && req.query.complexId) {
      await assertComplexClientAccess(req.query.complexId, { createBillingIfMissing: true });
    }

    const products = await Product.find(filter);
    res.json(products);
  } catch (error) {
    res.status(error.status || 500).json({ error: 'Error al obtener productos', detail: error.message });
  }
};

// PUT /api/products/:id
export const updateProduct = async (req, res) => {
  try {
    const prod = await Product.findById(req.params.id).populate('complexId');
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    assertOwner(prod.complexId, req.dbUser);
    const { name, description, price, stock, category, image } = req.body;
    if (name        !== undefined) prod.name        = name;
    if (description !== undefined) prod.description = description;
    if (price       !== undefined) prod.price       = price;
    if (stock       !== undefined) prod.stock       = stock;
    if (category    !== undefined) prod.category    = category;
    if (image       !== undefined) prod.image       = image;
    await prod.save();
    res.json(prod);
  } catch (error) {
    res.status(error.status || 400).json({ error: error.message || 'Error al actualizar producto' });
  }
};

// DELETE /api/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const prod = await Product.findById(req.params.id).populate('complexId');
    if (!prod) return res.status(404).json({ error: 'Producto no encontrado' });
    assertOwner(prod.complexId, req.dbUser);
    await prod.deleteOne();
    res.json({ message: 'Producto eliminado correctamente' });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Error al eliminar producto' });
  }
};
