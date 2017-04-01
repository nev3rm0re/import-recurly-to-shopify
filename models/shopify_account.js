module.exports = (sequelize, DataTypes) => {
    return sequelize.define("ShopifyAccount", {
        shopify_id: DataTypes.BIGINT,
        first_name: DataTypes.STRING,
        last_name: DataTypes.STRING,
        email: DataTypes.STRING,
        tags: DataTypes.STRING
    });
}