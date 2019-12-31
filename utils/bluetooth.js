import message from 'message'

export default {
  isOpen: false, //是否已经打开蓝牙Adapter
  connectedDevice: {}, //连接成功的设备
  status: 'close',

  options: {
    notifyId: '',
    writeId:'',
    serviceId: '',
    timeout: 30000,
    changeStatus: function (status) { },
    response: function (data) { }
  },


  init: function (options) {
    this.options = Object.assign(this.options, options)
    console.log(this.options)
  },

  //扫描周边蓝牙设备
  getDevices: function (callback) {
    let that = this
    that._openBluetoothAdapter(function (success, message) {
      if (!success) {
        callback(false, [])
        return
      }

      setTimeout(() => {
        //打开蓝牙扫描
        wx.startBluetoothDevicesDiscovery({
          success: function (res) {
            /* 获取蓝牙设备列表 */
            setTimeout(() => {
              wx.getBluetoothDevices({
                services: [],
                allowDuplicatesKey: false,
                interval: 0,
                success: function (res) {
                  let devices = res.devices
                  console.log('找到的设备', devices)
                  //停止扫描
                  wx.stopBluetoothDevicesDiscovery()
                  if (devices.length > 0) {
                    //按照信号强度排序
                    devices.sort(function (v1, v2) {
                      if (v1.RSSI > v2.RSSI) {
                        return -1
                      }
                      if (v1.RSSI < v2.RSSI) {
                        return 1
                      }
                      return 0
                    })
                  } 
                  callback(true, devices)
                },
                fail(res) {
                  console.log('扫描失败', res)
                  wx.stopBluetoothDevicesDiscovery()
                  //失败了返回失败和空数组
                  callback(false, [])
                }
              })
            }, 1000)
          },
          fail(res) {
            console.log('无法打开蓝牙扫描功能', res)
            //失败了返回失败和空数组
            callback(false, [])
          }
        })
      }, 1000)
    })
  },

  connect: function (device_id, callback) {
    let that = this
    console.log('连接设备：' + device_id)
    that._changeStatus('connecting')
    that._openBluetoothAdapter(function (success, message) {
      if (!success) {
        that._changeStatus('close')
        callback(false, message)
        return
      }

      //先关闭之前的连接
      that.closeConnect(function (success, message) {
        if (!success) {
          that._changeStatus('close')
          callback(false, message)
          return
        }

        //设置一个最长离线时间，如果到了这个时间还没有连接成功，就返回连接失败的回调
        let timeout = setTimeout(function () {
          that.closeConnect(function(success, message){
            callback(false, '[' + device_id + ']连接超时')
          })
        }, that.options.timeout)

        //设置监听连接状态变化
        wx.onBLEConnectionStateChange(function (res) {
          //console.log('监听' + device_id + '连接状态变化', res)
          //如果当前的连接设备连接丢失了
          if (!res.connected) {
            that.connectedDevice = {}
            that._changeStatus('close')
          }
        })

        wx.createBLEConnection({
          deviceId: device_id,
          success: function (res) {
            let system = wx.getSystemInfoSync()
            that.connectedDevice.deviceId = device_id
            //如果设置了serviceid和notifyid的话，就直接连接这个服务
            if (system.platform == 'android' && that.options.serviceId != '' && that.options.notifyId != '' && that.options.writeId != '') {
              console.log('直接连接=>', device_id , that.options.serviceId, that.options.notifyId, that.options.writeId)

              that.connectedDevice.notifyId = that.options.notifyId
              that.connectedDevice.serviceId = that.options.serviceId
              that.connectedDevice.write = that.options.writeId

              that._notifyBLECharacteristicValueChange(device_id, that.options.serviceId, that.options.notifyId, function (success, message) {
                clearTimeout(timeout)
                if (success) {
                  that._changeStatus('connected')
                  callback(true, '连接成功')
                } else {
                  that._changeStatus('close')
                  that.closeConnect(function(success, message){
                    callback(false, '连接失败')
                  })
                }
              })
            } else {
              console.log('连接=>', device_id)
              that._getBLEDeviceServices(device_id, function (success, message) {
                clearTimeout(timeout)
                if (success) {
                  that._changeStatus('connected')
                  callback(true, '连接成功')
                } else {
                  that._changeStatus('close')
                  that.closeConnect(function(success, message){
                    callback(false, '连接失败')
                  })
                }
              });
            }
          },
          fail: function (res) {
            clearTimeout(timeout)
            that._changeStatus('close')
            callback(false, '连接失败')
          }
        })
      })
    })
  },

  send(dataBuffer, callback) {
    let that = this;
    if(typeof dataBuffer == 'string'){
      dataBuffer = message.getBufferByString(dataBuffer)
    }

    that._sendBuffer(dataBuffer, 20, 10, callback)

    //let dataHex = that.ab2hex(dataBuffer);
    //this.writeDatas = that.hexCharCodeToStr(dataHex);
  },

  //关闭连接
  closeConnect(callback) {
    let that = this;
    //强制关闭
    if (callback === true) {
      that.connectedDevice = {}
      return
    }
    if (that.connectedDevice.deviceId) {
      wx.closeBLEConnection({
        deviceId: that.connectedDevice.deviceId,
        success: function (res) {
          console.log(that.connectedDevice.deviceId + '关闭连接成功', res)
          that.connectedDevice = {}
          callback(true, '关闭连接成功')
        },
        fail(res) {
          console.log(that.connectedDevice.deviceId + '关闭连接失败', res)
          callback(false, '关闭连接失败')
        }
      })
    } else {
      callback(true, '连接无需关闭')
    }
  },

  // 关闭蓝牙模块
  closeBluetoothAdapter() {
    let that = this;
    if (that.isOpen) {
      wx.closeBluetoothAdapter({
        success: function (res) {
          console.log('关闭模块成功', res)
          that.isOpen = false
        },
        fail: function (err) {
          console.log('关闭模块失败', err)
        }
      })
    }
  },

  //打开蓝牙模块并检查状态
  _openBluetoothAdapter: function (callback) {
    let that = this
    if (!that.isOpen) {
      wx.openBluetoothAdapter({
        success: function (res) {
          /* 获取本机的蓝牙状态 */
          setTimeout(() => {
            wx.getBluetoothAdapterState({
              success: function (res) {
                that.isOpen = true
                callback(true, '蓝牙状态正常')
                //that.startBluetoothDevicesDiscovery()
              },
              fail(res) {
                //console.log('蓝牙状态异常', res)
                callback(false, '蓝牙状态异常')
              }
            })
          }, 1000)
        },
        fail: function (err) {
          // 初始化失败
          //console.log('打开蓝牙失败', res)
          callback(false, '打开蓝牙接口失败')
        }
      })
    } else {
      callback(true, '蓝牙接口已经打开')
    }
  },

  //获取设备ID的所有服务
  _getBLEDeviceServices: function (device_id, callback) {
    let that = this
    setTimeout(() => {
      wx.getBLEDeviceServices({
        deviceId: device_id,
        success: function (res) {
          //如果options里头直接配置了serviceId，就直接连这个ServiceID，否则就根据扫描的一个一个连接
          if(that.options.serviceId!=''){
            that._getBLEDeviceCharacteristics(device_id, that.options.serviceId, callback)
          }else{
            if (res.services.length > 0) {
              for (let service in res.services) {
                service = res.services[service]
                that._getBLEDeviceCharacteristics(device_id, service.uuid, callback)
              }
            }else{
              //一个都找不到
              callback(false, '没有找到可用的服务ID')
            }
          }
        },
        fail: (res) => {
          callback(false, '获取服务ID失败')
        }
      })
    }, 1000)
  },

  //
  _getBLEDeviceCharacteristics: function (device_id, service_id, callback) {
    let that = this
    setTimeout(() => {
      wx.getBLEDeviceCharacteristics({
        deviceId: device_id,
        serviceId: service_id,
        success: function (res) {
          that.connectedDevice.service = service_id
          if(that.options.notifyId!='' && that.options.writeId!=''){
            that.connectedDevice.write = that.options.writeId
            that._notifyBLECharacteristicValueChange(device_id, service_id, that.options.notifyId, callback)
          }else{
            if(res.characteristics.length > 0){
              for (let ch in res.characteristics) {
                ch = res.characteristics[ch]
                //console.log('特征值ID:[', ch.uuid, '] notify=', ch.properties.notify, 'read=',ch.properties.read, 'write=', ch.properties.write)

                //支持Notify
                if (ch.properties.notify) {
                  //console.log('服务' + service_id + '可用特征值ID->' + ch.uuid)
                  that._notifyBLECharacteristicValueChange(device_id, service_id, ch.uuid, callback)
                }

                //支持Write，记住这个ID，之后给发送的方法用
                if(ch.properties.write){
                  that.connectedDevice.write = ch.uuid
                  //console.log('找到写特征值' + that.connectedDevice.write)
                }
              }
            }else{
              callback(false, '没有找到可用的特征值ID')
            }
          }

          
        },
        fail: function (res) {
          console.log('获取' + service_id + '服务特征值失败', res)
        }
      })
    }, 1000)
  },

  // 启用低功耗蓝牙设备特征值变化时的 notify 功能
  _notifyBLECharacteristicValueChange: function (device_id, service_id, notify_id, callback) {
    let that = this

    //判断能否监听
    wx.notifyBLECharacteristicValueChange({
      state: true,
      deviceId: device_id,
      serviceId: service_id,
      characteristicId: notify_id,
      complete(res) {
        //监听蓝牙发过来的数据
        setTimeout(function(){
          wx.onBLECharacteristicValueChange(function (res) {
            //console.log('收到数据', res.value)
            that.options.response(res.value)
          })

          that.connectedDevice.notify = notify_id
          callback(true, '特征值' + notify_id + '监听成功，开始接收数据')
        }, 1000)
        
      },
      fail(res) {
        console.log('特征值' + notify_id + '监听失败', res)
        callback(false, '特征值' + notify_id + '监听失败')
      }
    })
  },

  _sendBuffer: function (buffer, limit, retry, callback) {
    let that = this
    if(that.status != 'connected'){
      callback(false, '未连接,发送失败')
      return
    }
    let send_buffer = send_buffer = buffer.slice(0, limit)
    wx.writeBLECharacteristicValue({
      deviceId: that.connectedDevice.deviceId,
      serviceId: that.connectedDevice.serviceId,
      characteristicId: that.connectedDevice.writeId,
      value: send_buffer,
      success: function (res) {
        //console.log('发送的数据：' + that.writeDatas)
        //console.log('message发送成功')
        buffer = buffer.slice(limit)
      },
      fail: function (res) {
        retry--
        console.log('数据发送异常，重试：', retry, res)
        if (retry <= 0) {
          //console.log('数据发送失败')
          callback(false, '数据发送失败')
          return
        }
      },
      complete: function (res) {
        console.log('剩余数据', buffer.byteLength)
        if (buffer.byteLength > 0 && retry > 0) {
          setTimeout(function () {
            that._sendBuffer(buffer, limit, retry, callback)
          }, 10)
        }else{
          //console.log('发送完成')
          callback(true, '数据发送完成')
        }
      }
    })
  },

  _changeStatus: function (status) {
    this.status = status
    this.options.changeStatus(status, this.connectedDevice.deviceId)
  }
}