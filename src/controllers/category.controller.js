const categoryModel = require('../models/category.model');
const { buildMessageResponse } = require('../views/auth.view');
const { buildCategoriesResponse, buildCategoryResponse } = require('../views/category.view');

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

    return res
      .status(result.created ? 201 : 200)
      .json(
        buildCategoryResponse(
          result.category,
          result.created ? 'Categoria creada correctamente' : 'La categoria ya existia',
        ),
      );
  } catch (error) {
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

module.exports = {
  listCategories,
  createCategory,
  deleteCategory,
};
