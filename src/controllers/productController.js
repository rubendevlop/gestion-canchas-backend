import Product from '../models/Product.js';
import Complex from '../models/Complex.js';

export const createProduct = async (req, res) => {
  try {
    const { name, description, price, stock, category, image, complexId } = req.body;
    
    // Verificar que el complejo exista
    const complex = await Complex.findById(complexId);
    if (!complex) return res.status(404).json({ error: 'Complejo no encontrado' });

    // Validar propiedad del complejo
    if (req.dbUser.role !== 'superadmin' && complex.ownerId.toString() !== req.dbUser._id.toString()) {
        return res.status(403).json({ error: 'No tienes permiso para agregar productos a este complejo' });
    }

    const newProduct = new Product({
      name, description, price, stock, category, image, complexId
    });

    await newProduct.save();
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear producto', detail: error.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    // Si se pasa complexId, trae solo los productos de ese complejo (Vitrina de E-commerce)
    const filter = {};
    if (req.query.complexId) filter.complexId = req.query.complexId;
    if (req.query.category) filter.category = req.query.category;

    const products = await Product.find(filter);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos', detail: error.message });
  }
};
