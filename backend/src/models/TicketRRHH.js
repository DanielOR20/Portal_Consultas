'use strict';

module.exports = (sequelize, DataTypes) => {
  const TicketRRHH = sequelize.define(
    'TicketRRHH',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
      },
      codigo: {
        type: DataTypes.STRING(30),
        allowNull: false,
        unique: true
      },
      colaborador_id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      consulta_original: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      motivo: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      estado: {
        type: DataTypes.ENUM('abierto', 'en_revision', 'resuelto'),
        allowNull: false,
        defaultValue: 'abierto'
      },
      respuesta_rrhh: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      atendido_por: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      resuelto_en: {
        type: DataTypes.DATE,
        allowNull: true
      }
    },
    {
      tableName: 'tickets_rrhh',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      underscored: true
    }
  );

  TicketRRHH.associate = (models) => {
    TicketRRHH.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
    TicketRRHH.belongsTo(models.Colaborador, {
      as: 'atendedor',
      foreignKey: 'atendido_por'
    });
  };

  return TicketRRHH;
};

