'use strict';

module.exports = (sequelize, DataTypes) => {
  const PalabraClave = sequelize.define(
    'PalabraClave',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      palabra: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      categoria: {
        type: DataTypes.ENUM(
          'restringida',
          'fuera_alcance',
          'politica',
          'dato_personal',
          'tema_dashboard'
        ),
        allowNull: false
      },
      tema_asociado: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      activa: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      }
    },
    {
      tableName: 'palabras_clave',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true
    }
  );

  return PalabraClave;
};

