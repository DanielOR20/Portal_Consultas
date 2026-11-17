'use strict';

module.exports = (sequelize, DataTypes) => {
  const MovimientoPersonal = sequelize.define(
    'MovimientoPersonal',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      colaborador_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      tipo: {
        type: DataTypes.ENUM('ingreso', 'salida', 'ascenso'),
        allowNull: false
      },
      fecha: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      motivo: {
        type: DataTypes.STRING(255),
        allowNull: false
      }
    },
    {
      tableName: 'movimientos_personal',
      timestamps: false,
      underscored: true
    }
  );

  MovimientoPersonal.associate = (models) => {
    MovimientoPersonal.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
  };

  return MovimientoPersonal;
};

