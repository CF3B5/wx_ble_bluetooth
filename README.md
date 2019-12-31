# wx_ble_bluetooth
封装了微信小程序的BLE蓝牙模块，支持Ios和安卓，相对来说比较容易使用了！
但是写完才发现BLE蓝牙不适合传输大数据，因为是低功耗蓝牙，所以传输速度很差，每次只能20个字节20个字节的传，而且还要休眠10ms左右……
原本低功耗蓝牙就是为了各种操作指令准备的，而不是传输数据……晕菜！


使用方法，先引入
```Javascript
import bluetooth from '../../utils/bluetooth'
```

在合适的地方初始化
```Javascript
bluetooth.init({
  //这3个值设定了，会加快设备的连接速度，一般设备都会固定下来
  notifyId: '', //负责接收数据的特征值ID
  writeId:'', //负责发送数据的特征值ID
  serviceId: '', //主服务ID
  //连接超时，30s
  timeout: 30000, 
  
  //状态发生变化的时候会回调
  changeStatus: function (status, deviceId) {
    console.log('蓝牙连接状态=>', status, deviceId)
  },
  //收到数据回调
  response: function (data) {
    console.log('收到数据', data)
  }
```

扫描周边的设备，success代表扫描是否成功，devices是扫描的设备数组
```Javascript
bluetooth.getDevices(function (success, devices) {
    console.log('扫描=>', success, devices)
})
```

连接指定的设备，
```Javascript
bluetooth.connect(deviceId, function (success, message) {
    console.log(success, message)
})
```
