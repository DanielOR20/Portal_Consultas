'use strict';

module.exports = (sequelize, DataTypes) => {
  const ReporteDiario = sequelize.define(
    'ReporteDiario',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        unique: true
      },
      datos_json: {
        type: DataTypes.JSON,
        allowNull: false
      },
      resumen_texto: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      generado_por: {
        type: DataTypes.STRING(100),
        allowNull: false
      }
    },
    {
      tableName: 'reportes_diarios',
      timestamps: false,
      underscored: true
    }
  );

  return ReporteDiario;
};
