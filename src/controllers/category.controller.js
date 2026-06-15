const categoryModel = require('../models/category.model');
const { buildMessageResponse } = require('../views/auth.view');
const {
  buildCategoriesResponse,
  buildCategoryResponse,
  buildSubcategoriesResponse,
  buildSubcategoryResponse,
} = require('../views/category.view');

async function listCategories(_req, res, next) {
  try {
    const categories = await categoryModel.listCategories();
    return res.status(200).json(buildCategoriesResponse(categories));
  } catch (error) {
    next(error);
  }
}

async function createCategory(req, res, next) {
  try {
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json(buildMessageResponse('El nombre de la categoria es obligatorio'));
    }

    const result = await categoryModel.createCategory(nombre);

    if (!result.created) {
      return res.status(409).json(buildMessageResponse('Ya existe una categoria con ese nombre'));
    }

    return res
      .status(201)
      .json(buildCategoryResponse(result.category, 'Categoria creada correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe una categoria con ese nombre'));
    }

    next(error);
  }
}

async function deleteCategory(req, res, next) {
  try {
    const result = await categoryModel.deleteCategory(Number(req.params.id));

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Categoria no encontrada'));
    }

    if (result.error === 'IN_USE') {
      return res.status(409).json(buildMessageResponse('No se puede eliminar una categoria en uso'));
    }

    return res.status(200).json({
      ok: true,
      message: 'Categoria eliminada correctamente',
    });
  } catch (error) {
    next(error);
  }
}

async function updateCategory(req, res, next) {
  try {
    const { nombre } = req.body;

    if (!nombre || !nombre.trim()) {
      return res.status(400).json(buildMessageResponse('El nombre de la categoria es obligatorio'));
    }

    const result = await categoryModel.updateCategory(Number(req.params.id), nombre);

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Categoria no encontrada'));
    }

    if (result.error === 'DUPLICATE') {
      return res.status(409).json(buildMessageResponse('Ya existe una categoria con ese nombre'));
    }

    return res
      .status(200)
      .json(buildCategoryResponse(result.category, 'Categoria actualizada correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe una categoria con ese nombre'));
    }

    next(error);
  }
}

async function listSubcategories(_req, res, next) {
  try {
    const subcategories = await categoryModel.listSubcategories();
    return res.status(200).json(buildSubcategoriesResponse(subcategories));
  } catch (error) {
    next(error);
  }
}

async function createSubcategory(req, res, next) {
  try {
    const categoriaId = Number(req.body.categoriaId);
    const { nombre } = req.body;

    if (!categoriaId || Number.isNaN(categoriaId)) {
      return res.status(400).json(buildMessageResponse('La categoria es obligatoria'));
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json(buildMessageResponse('El nombre de la subcategoria es obligatorio'));
    }

    const result = await categoryModel.createSubcategory(categoriaId, nombre);

    if (result.error === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Categoria no encontrada'));
    }

    if (result.error === 'DUPLICATE') {
      return res.status(409).json(buildMessageResponse('Ya existe una subcategoria con ese nombre en esa categoria'));
    }

    return res
      .status(201)
      .json(buildSubcategoryResponse(result.subcategory, 'Subcategoria creada correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe una subcategoria con ese nombre en esa categoria'));
    }

    next(error);
  }
}

async function updateSubcategory(req, res, next) {
  try {
    const categoriaId = Number(req.body.categoriaId);
    const { nombre } = req.body;

    if (!categoriaId || Number.isNaN(categoriaId)) {
      return res.status(400).json(buildMessageResponse('La categoria es obligatoria'));
    }

    if (!nombre || !nombre.trim()) {
      return res.status(400).json(buildMessageResponse('El nombre de la subcategoria es obligatorio'));
    }

    const result = await categoryModel.updateSubcategory(Number(req.params.id), {
      categoriaId,
      nombre,
    });

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Subcategoria no encontrada'));
    }

    if (result.error === 'CATEGORY_NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Categoria no encontrada'));
    }

    if (result.error === 'DUPLICATE') {
      return res.status(409).json(buildMessageResponse('Ya existe una subcategoria con ese nombre en esa categoria'));
    }

    return res
      .status(200)
      .json(buildSubcategoryResponse(result.subcategory, 'Subcategoria actualizada correctamente'));
  } catch (error) {
    if (error?.code === '23505') {
      return res.status(409).json(buildMessageResponse('Ya existe una subcategoria con ese nombre en esa categoria'));
    }

    next(error);
  }
}

async function deleteSubcategory(req, res, next) {
  try {
    const result = await categoryModel.deleteSubcategory(Number(req.params.id));

    if (result.error === 'NOT_FOUND') {
      return res.status(404).json(buildMessageResponse('Subcategoria no encontrada'));
    }

    if (result.error === 'IN_USE') {
      return res.status(409).json(buildMessageResponse('No se puede eliminar una subcategoria en uso'));
    }

    return res.status(200).json({
      ok: true,
      message: 'Subcategoria eliminada correctamente',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
};
