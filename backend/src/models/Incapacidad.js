'use strict';

module.exports = (sequelize, DataTypes) => {
  const Incapacidad = sequelize.define(
    'Incapacidad',
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
        type: DataTypes.ENUM('enfermedad_comun', 'riesgo_trabajo', 'maternidad'),
        allowNull: false
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      dias: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      entidad: {
        type: DataTypes.ENUM('CCSS', 'INS'),
        allowNull: false
      }
    },
    {
      tableName: 'incapacidades',
      timestamps: false,
      underscored: true
    }
  );

  Incapacidad.associate = (models) => {
    Incapacidad.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
  };

  return Incapacidad;
};

