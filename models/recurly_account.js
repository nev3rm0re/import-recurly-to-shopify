module.exports = (sequelize, DataTypes) => {
    const RecurlyAccount = sequelize.define("RecurlyAccount", {
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
        email: DataTypes.STRING,
        subscription: DataTypes.STRING
    });

    return RecurlyAccount;
}