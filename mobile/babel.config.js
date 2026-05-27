module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        safe: true,       // .env.example에 없는 키 사용 시 에러 발생
        allowUndefined: false,
      },
    ],
  ],
};
