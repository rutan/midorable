# @rutan/midorable-platform-browser

`@rutan/midorable` のブラウザ向けPlatform層の実装を提供するパッケージです。

## Install

```bash
npm install @rutan/midorable-platform-browser
```

## 各種実装について

### WebGL2

WebGL2 APIを使用した実装を提供します。
`@rutan/midorable-platform-browser` のメイン実装です。

### Canvas

Canvas APIを使用した最小限の実装を提供します。
一部のBlendModeやShaderは非対応です。

### WebGPU

WebGPU APIを使用した実装を提供します。
現在は実験的な実装であり、production環境での使用は推奨されません。

## License

MIT License.
