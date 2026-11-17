'use strict';

module.exports = (sequelize, DataTypes) => {
  const ConsultaChat = sequelize.define(
    'ConsultaChat',
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
      pregunta: {
        type: DataTypes.TEXT,
        allowNull: false
      },
      intencion: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      agente: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      documentos_citados: {
        type: DataTypes.JSON,
        allowNull: true
      },
      resuelta: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      escalada: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      latencia_ms: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      fecha: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'consultas_chat',
      timestamps: false,
      underscored: true
    }
  );

  ConsultaChat.associate = (models) => {
    ConsultaChat.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
  };

  return ConsultaChat;
};

