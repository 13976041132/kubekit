package controllers

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/Orientsoft/kubekit/models"
	"github.com/Orientsoft/kubekit/utils"

	"github.com/gin-gonic/gin"
)

const (
	installCmd = "curl -L http://%s/node.sh | bash -s %s %s %s --token=%s %s:6443>install.log 2>&1 &"
)

func (router *MainRouter) InstallNodeHandler(c *gin.Context) {
	params := struct {
		Ids []string `json:"ids"`
	}{}

	c.BindJSON(&params)
	fmt.Println("Params.Ids:", params.Ids)

	if len(params.Ids) > 0 {
		router.startInstall(params.Ids)
	}

	resp := models.Response{Success: true, Message: "OK!", Data: nil}
	c.JSON(http.StatusOK, resp)
}

func (router *MainRouter) startInstall(ids []string) {
	masterIP := utils.GetMasterIP()
	token := utils.GetToken()
	masterAddr := masterIP + router.filePort
	kitAddr := masterIP + router.toolkitPort

	if masterIP != "" && token != "" {
		for _, id := range ids {
			go utils.ExecuteCmd(router.nodeMap[id], fmt.Sprintf(installCmd, masterAddr, masterAddr, kitAddr, id, token, masterIP))
		}
	}
}

func (router *MainRouter) NodeProgressHandler(c *gin.Context) {
	id := c.Param("id")
	step := c.Param("step")

	if id == "" || step == "" {
		return
	}

	//if node id doesn't exist, just return
	if _, ok := router.nodeMap[id]; !ok {
		return
	}

	var comment string
	status := 1

	switch step {
	case "1":
		comment = "(1/5) Installing Docker Engine"
	case "2":
		comment = "(2/5) Loading K8S images"
	case "3":
		comment = "(3/5) Installing K8S components"
	case "4":
		comment = "(4/5) Joining K8S cluster"
	case "5":
		comment = "Done"
		status = 2
	}

	//Update node status
	router.nodeList.UpdateNodeStatus(id, comment, status)

	//Update node map in memory
	node := router.nodeMap[id]
	node.Comment = comment
	node.Status = status

	//Broadcast websocket message to all clients
	if data, err := json.Marshal(node); err == nil {
		sendMessage(data)
	}
}
