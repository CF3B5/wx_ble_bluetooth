//index.js
import bluetooth from '../../utils/bluetooth'
//获取应用实例
const app = getApp()

Page({
  data: {
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),

    devices: [],
    connected: false
  },
  //事件处理函数
  bindViewTap: function () {
    wx.navigateTo({
      url: '../logs/logs'
    })
  },
  onLoad: function () {
    if (app.globalData.userInfo) {
      this.setData({
        userInfo: app.globalData.userInfo,
        hasUserInfo: true
      })
    } else if (this.data.canIUse) {
      // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
      // 所以此处加入 callback 以防止这种情况
      app.userInfoReadyCallback = res => {
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
      }
    } else {
      // 在没有 open-type=getUserInfo 版本的兼容处理
      wx.getUserInfo({
        success: res => {
          app.globalData.userInfo = res.userInfo
          this.setData({
            userInfo: res.userInfo,
            hasUserInfo: true
          })
        }
      })
    }
    let _this = this
    bluetooth.init({
      changeStatus: function (status, deviceId) {
        console.log('蓝牙连接状态=>', status)
        switch (status) {
          case 'connecting':
            wx.showToast({
              title: '连接中...',
              icon: 'loading',
              duration: 30000,
              mask: true
            })
            break
          case 'connected':
            wx.showToast({
              title: '连接成功',
              icon: 'success',
              duration: 2000
            })
            _this.setData({
              connected: deviceId
            })
            break
          case 'close':
            wx.showToast({
              title: '连接关闭',
              icon: 'none',
              duration: 5000
            })
            _this.setData({
              connected: false
            })
        }
      },
      response: function (data) {
        console.log('收到数据', data)
      }
    })

    wx.showToast({
      title: '扫描中...',
      icon: 'loading',
      duration: 30000,
      mask: true
    })
    bluetooth.getDevices(function (success, devices) {
      if (success) {
        console.log('附近的设备', devices)
        wx.showToast({
          title: '扫描到' + devices.length + '设备',
          icon: 'none',
          duration: 2000
        })
        _this.setData({
          devices: devices
        })
      }else{
        wx.showToast({
          title: '扫描失败',
          icon: 'none',
          duration: 2000
        })
      }
    })

    // bluetooth.connect('B8:27:EB:F6:63:74', function(success, message){
    //   console.log('连接设备', success, message)
    // })
  },
  getUserInfo: function (e) {
    console.log(e)
    app.globalData.userInfo = e.detail.userInfo
    this.setData({
      userInfo: e.detail.userInfo,
      hasUserInfo: true
    })
  },
  onSend: function (e) {
    bluetooth.send('Hello World', function (success, message) {
      console.log(success, message)
    })
  },
  onConnect: function (e) {
    let _this = this
    let item = e.currentTarget.dataset.item
    console.log(item)
    bluetooth.connect(item.deviceId, function (success, message) {
      console.log(success, message)
    })
  }
})