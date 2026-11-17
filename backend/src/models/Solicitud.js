'use strict';

module.exports = (sequelize, DataTypes) => {
  const Solicitud = sequelize.define(
    'Solicitud',
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
        type: DataTypes.ENUM('vacaciones', 'permiso_con_goce', 'permiso_sin_goce', 'teletrabajo'),
        allowNull: false
      },
      fecha_inicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      fecha_fin: {
        type: DataTypes.DATEONLY,
        allowNull: false
      },
      estado: {
        type: DataTypes.ENUM('pendiente', 'aprobada', 'rechazada'),
        allowNull: false,
        defaultValue: 'pendiente'
      },
      aprobador_id: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      creada_en: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      }
    },
    {
      tableName: 'solicitudes',
      timestamps: false,
      underscored: true
    }
  );

  Solicitud.associate = (models) => {
    Solicitud.belongsTo(models.Colaborador, {
      as: 'colaborador',
      foreignKey: 'colaborador_id'
    });
    Solicitud.belongsTo(models.Colaborador, {
      as: 'aprobador',
      foreignKey: 'aprobador_id'
    });
  };

  return Solicitud;
};

