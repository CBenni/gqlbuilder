const path = require("path");

module.exports = {
    module: {
        rules: [
            {
                test: /templates/,
                use: 'raw-loader'
            },
            {
                test: /\.html$/,
                use: [
                    {
                        loader: 'file-loader',
                        options: { name: 'pages/[name].[ext]', },
                    },
                ],
                exclude: [path.resolve(__dirname, 'src/templates'), path.resolve(__dirname, 'src/html/index.html')]
            },
            {
                test: /\.s[ac]ss$/i,
                use: [
                    // Creates `style` nodes from JS strings
                    "style-loader",
                    // Translates CSS into CommonJS
                    "css-loader",
                    // Compiles Sass to CSS
                    "sass-loader",
                ],
            },
        ],
    },
    optimization: {
        minimize: false
    }
};