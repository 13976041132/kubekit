$(document).ready(function () {
  connectServer();

  selNodes = [];

  if (selNodes.length === 0) {
    $('#btn-deploy').attr('disabled', 'disabled');
  }

  $('td input').on('ifChecked', function (event) {
    selNodes.push(event.target.id);
    $('#btn-deploy').removeAttr('disabled');
    console.log(selNodes);
  });

  $('td input').on('ifUnchecked', function (event) {
    for (var i = selNodes.length - 1; i >= 0; i--) {
      if (selNodes[i] === event.target.id) {
        selNodes.splice(i, 1);
      }
    }

    if (selNodes.length === 0) {
      $('#btn-deploy').attr('disabled', 'disabled');
    }

    console.log(selNodes);
  });

  //节点提交验证
  $('#nodeForm').bootstrapValidator({
    message: 'This value is not valid',
    submitHandler: null,
    live: 'disabled',
    fields: {
      name: {
        message: nodeform_invalid_name,
        validators: {
          notEmpty: {
            message: nodeform_empty_name
          },
          stringLength: {
            min: 4,
            max: 15,
            message: nodeform_name_length
          },
          regexp: {
            regexp: /^[a-zA-Z0-9\-_]+$/,
            message: nodeform_name_regex
          }
        }
      },
      ip: {
        validators: {
          notEmpty: {
            message: nodeform_empty_ip
          },
          regexp: {
            regexp: /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
            message: nodeform_invalid_ip
          }
        }
      },
      password: {
        validators: {
          notEmpty: {
            message: nodeform_empty_password
          }
        }
      },
      confirmPassword: {
        validators: {
          notEmpty: {
            message: nodeform_empty_password
          },
          identical: {
            field: 'password',
            message: nodeform_password_mismatch
          }
        }
      },
      port: {
        validators: {
          notEmpty: {
            message: nodeform_empty_port
          },
          digits: {
            message: nodeform_invalid_port
          }
        }
      }
    }
  });

  //提交添加节点
  $('#add-node').click(function (e) {
    e.preventDefault();

    var bootstrapValidator = $('#nodeForm').data('bootstrapValidator');
    //手动触发验证
    bootstrapValidator.validate();
    if (bootstrapValidator.isValid()) {
      // Send request to add new node
      axios.post('/node', {
          name: $('#name').val(),
          ip: $('#ip').val(),
          port: parseInt($('#port').val()),
          password: $('#password').val(),
        })
        .then(function (response) {
          if (response.data.success) {
            toastr.success(nodeform_success);
            $("#close-modal").trigger("click");
            //Refresh page
            setTimeout(function () {
              location.reload();
            }, 2000);
          } else {
            toastr.error(nodeform_failed + '<br/>' + response.data.message);
          }
        })
        .catch(function (error) {
          console.log(error);
          toastr.error(nodeform_failed);
        });
    }
  });
})

function parseStatus(status) {
  switch (status) {
    case 0:
      return '<span class="label label-default">' + status_ready +'</span>'
      break;
    case 1:
      return '<span class="label label-info">' + status_deploying + '</span>'
      break;
    case 2:
      return '<span class="label label-success">' + status_deployed + '</span>'
      break;
    case 3:
      return '<span class="label label-warning">' + status_disconnect + '</span>'
      break;
    case 4:
      return '<span class="label label-error">' + status_failed + '</span>'
      break;
  }
}

function getInstallLog(nodeId, nodeName) {
  console.log('Get node log:' + nodeId);
  $('#modalLog').modal();
  $('#modalLogTitle').text( logform_title + ' - ' + nodeName);
  $('#logContent').html('<img id="loader" height="24" src="/assets/img/loader.svg" /> ' + logform_origin);

  axios.get("/node/log/" + nodeId)
    .then((response) => {
      if (response.data.success) {
        $('#logContent').html(response.data.data.replace(/\n/g, "<br />").replace(/\r/g, "<br />"));
        $("#logContent").scrollTop($("#logContent")[0].scrollHeight);
      } else {
        toastr.error(response.data.message);
      }
    })
    .catch((error) => {
      toastr.error(logform_failed);
    });
}

function refreshNode(nodeId) {
  console.log('Refresh node:' + nodeId);
  axios.get("/node/refresh/" + nodeId)
    .then((response) => {
      if (response.data.success) {
        toastr.success(refresh_success);
        console.log(response.data.data);
        $('#status-' + response.data.data.id).html(parseStatus(response.data.data.status));

        if (response.data.data.status === 1) {
          $('#comment-' + response.data.data.id).html('<img id="loader" height="24" src="/assets/img/loader.svg" /> ' + response.data.data.comment);
        } else {
          $('#comment-' + response.data.data.id).text(response.data.data.comment);
        }
      } else {
        toastr.error(refresh_failed);
      }
    })
    .catch((error) => {
      toastr.error(refresh_failed);
    });
}

function removeNode(nodeId) {

  console.log('Remove node:' + nodeId);
  nodeName = $('#name-' + nodeId).text();

  alertify.confirm(remove_title, remove_confirm +' <strong>' + nodeName + '</strong> ?', function () {
    axios.put("/node/remove/" + nodeId)
      .then((response) => {
        if (response.data.success) {
          toastr.success(remove_success);
          //Refresh page
          setTimeout(function () {
            location.reload();
          }, 2000);
        } else {
          toastr.error(remove_failed);
        }
      })
      .catch((error) => {
        toastr.error(remove_failed);
      });
  }, function () {}).set('labels', {
    ok: remove_ok,
    cancel: remove_cancel
  });;
}

function batchInstall() {
  axios.post('/install', {
      ids: selNodes
    })
    .then(function (response) {
      if (response.data.success) {
        toastr.success(batch_success);
        $("#close-modal").trigger("click");
        //Refresh page
        setTimeout(function () {
          location.reload();
        }, 2000);
      } else {
        toastr.error(batch_failed +'<br/>' + response.data.message);
      }
    })
    .catch(function (error) {
      console.log(error);
      toastr.error(batch_failed);
    });
}

function toggleDashboard() {
  window.open('http://' + location.hostname + ":31234");
}

function connectServer() {
  var sock = null;
  var wsuri = "ws://" + location.host + "/ws";

  try {
    sock = new WebSocket(wsuri);
  } catch (e) {}

  sock.onopen = function () {
    console.log("connected to " + wsuri);
  };

  sock.onerror = function (e) {
    console.log(" error from connect " + e);
  };

  sock.onclose = function (e) {
    console.log("connection closed (" + e.code + ")");
  };

  sock.onmessage = function (e) {
    console.log("message received: " + e.data);

    var data = $.parseJSON(e.data);
    $('#status-' + data.id).html(parseStatus(data.status));

    if (data.status === 1) {
      $('#comment-' + data.id).html('<img id="loader" height="24" src="/assets/img/loader.svg" /> ' + data.comment);
    } else {
      $('#comment-' + data.id).text(data.comment);
    }
  };
}
