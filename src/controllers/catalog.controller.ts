import { Request, Response } from "express";
import Catalog from "../models/catalog.model";

export const getCatalogos = async (req: Request, res: Response) => {
  try {
    const catalogos = await Catalog.find();
    const response: Record<string, any[]> = {};

    catalogos.forEach((catalogo) => {
      response[catalogo.tipo] = catalogo.valores.filter(
        (v) => v.activo
      );
    });

    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al obtener catálogos"
    });
  }
};

export const createCatalog = async (req: Request, res: Response) => {
  try {
    const { tipo, label, editable, orden } = req.body;

    const catalogo = await Catalog.create({
      tipo,
      label,
      editable,
      orden,
      valores: []
    });

    res.status(201).json(catalogo);
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: "El catálogo ya existe"
      });
    }

    console.error(error);
    res.status(500).json({
      message: "Error al crear catálogo"
    });
  }
};

export const addCatalogValue = async (req: Request, res: Response) => {
  try {
    const { catalogId } = req.params;
    const { label, metadata } = req.body;

    if (!label) {
      return res.status(400).json({
        message: "El label es obligatorio"
      });
    }

    const catalog = await Catalog.findById(catalogId);

    if (!catalog) {
      return res.status(404).json({
        message: "Catálogo no encontrado"
      });
    }

    // 🔒 validar duplicado (case insensitive)
    const exists = catalog.valores.some(
      v => v.label.toLowerCase() === label.toLowerCase()
    );

    if (exists) {
      return res.status(400).json({
        message: "El valor ya existe en este catálogo"
      });
    }

    // 🔑 generar key automáticamente
    const key = label
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");

    catalog.valores.push({
      key,
      label,
      activo: true,
      metadata: metadata || {}
    });

    await catalog.save();

    res.status(201).json({
      message: "Valor agregado correctamente",
      catalog
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al agregar valor al catálogo"
    });
  }
};

export const getCatalogById = async (req: Request, res: Response) => {
  try {
    const { catalogId } = req.params;

    const catalogo = await Catalog.findById(catalogId);

    if (!catalogo) {
      return res.status(404).json({ message: "Catálogo no encontrado" });
    }

    res.json(catalogo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener catálogo" });
  }
};


export const deleteCatalogValue = async (req: Request, res: Response) => {
  try {
    const { tipo, key } = req.params;

    const catalogo = await Catalog.findOne({ tipo });
    if (!catalogo) {
      return res.status(404).json({ message: "Catálogo no encontrado" });
    }

    // Filtramos el valor que queremos eliminar
    const initialLength = catalogo.valores.length;
    catalogo.valores = catalogo.valores.filter((v) => v.key !== key);

    if (catalogo.valores.length === initialLength) {
      return res.status(404).json({ message: "Valor no encontrado" });
    }

    await catalogo.save();

    res.json({ message: "Valor eliminado correctamente" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al eliminar valor" });
  }
};


export const getCatalogByTipo = async (req: Request, res: Response) => {
  try {
    const { tipo } = req.params;

    const catalogo = await Catalog.findOne({ tipo });

    if (!catalogo) {
      return res.status(404).json({
        message: "Catálogo no encontrado"
      });
    }

    res.json(catalogo);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Error al obtener catálogo"
    });
  }
};

// GET /api/catalogos/list
export const getCatalogosList = async (req: Request, res: Response) => {
  try {
    const catalogos = await Catalog.find({}, "_id tipo label");

    res.json(catalogos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al obtener catálogos" });
  }
};
