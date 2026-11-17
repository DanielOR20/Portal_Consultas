'use strict';

module.exports = (sequelize, DataTypes) => {
  const SaldoVacaciones = sequelize.define(
    'SaldoVacaciones',
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
      periodo: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      dias_asignados: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 15.0
      },
      dias_tomados: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0.0
      },
      dias_disponibles: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 15.0
      }
    },
    {
      tableName: 'saldos_vacaciones',
      timestamps: false,
      underscored: true
    }
  );

  SaldoVacaciones.associate = (models) => {
    SaldoVacaciones.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
  };

  return SaldoVacaciones;
};

