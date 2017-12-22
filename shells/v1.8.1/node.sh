#!/bin/bash

# K8S offline install script.
# Installed & verified by CentOS Linux release 7.4.1708 (Core)

set -x
set -e

HTTP_SERVER=""
KIT_SERVER=""
ID=""
KUBE_REPO_PREFIX=gcr.io/google_containers

root=$(id -u)
if [ "$root" -ne 0 ] ;then
    echo must run as root
    exit 1
fi

kube::install_docker()
{
    set +e
    which docker > /dev/null 2>&1
    i=$?
    set -e
    if [ $i -ne 0 ]; then
        curl -L http://$HTTP_SERVER/rpms/docker.tar.gz > /tmp/docker.tar.gz 
        tar zxf /tmp/docker.tar.gz -C /tmp
        yum localinstall -y /tmp/docker/*.rpm
        kube::config_docker
        systemctl enable docker.service && systemctl start docker.service

        # Modify them after docker is started
        echo 1 > /proc/sys/net/bridge/bridge-nf-call-iptables
        echo 1 > /proc/sys/net/bridge/bridge-nf-call-ip6tables
    fi

    echo docker has been installed!
    docker version
    rm -rf /tmp/docker /tmp/docker.tar.gz
}

kube::config_docker()
{
    setenforce 0
    sed -i -e 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/sysconfig/selinux

    set +e
    which firewalld
    j=$?
    set -e

    if [ $j -eq 0 ]; then
    systemctl disable firewalld
    systemctl stop firewalld
    fi
 
    # Import orient CA cert.
    curl -L http://$HTTP_SERVER/certs/k8s-ca.crt > /etc/pki/ca-trust/source/anchors/k8s-ca.crt
    update-ca-trust

    echo DOCKER_STORAGE_OPTIONS=\" -s overlay --selinux-enabled=false\" > /etc/sysconfig/docker-storage
    systemctl daemon-reload && systemctl restart docker.service
}

kube::load_images()
{
    mkdir -p /tmp/k8s
    
    node_images=(
        pause-amd64_3.0
        kube-proxy-amd64_v1.8.2
        flannel-amd64_v0.9.0
        kubernetes-dashboard-amd64_v1.7.1
    )

    for i in "${!node_images[@]}"; do 
        ret=$(docker images | awk 'NR!=1{print $1"_"$2}' | grep $KUBE_REPO_PREFIX/${node_images[$i]} |  wc -l)
        if [ $ret -lt 1 ];then
            curl -L http://$HTTP_SERVER/images/${node_images[$i]}.tar > /tmp/k8s/${node_images[$i]}.tar
            docker load < /tmp/k8s/${node_images[$i]}.tar
        fi
    done

    rm /tmp/k8s* -rf 
}

kube::install_bin()
{
    set +e
    which kubeadm > /dev/null 2>&1
    i=$?
    set -e
    if [ $i -ne 0 ]; then
        curl -L http://$HTTP_SERVER/rpms/k8s.tar.gz > /tmp/k8s.tar.gz
        tar zxf /tmp/k8s.tar.gz -C /tmp
        yum localinstall -y  /tmp/k8s/*.rpm
        rm -rf /tmp/k8s*

        # Disable swap for K8S 1.8
        swapoff -a
        sed -i -e /swap/d /etc/fstab

        # Enable and start kubelet service
        systemctl enable kubelet.service && systemctl start kubelet.service && rm -rf /etc/kubernetes
    fi
}

kube::config_firewalld()
{
    set +e
    which firewalld
    j=$?
    set -e

    if [ $j -eq 0 ]; then
    systemctl disable firewalld
    systemctl stop firewalld
    fi

    # iptables -A IN_public_allow -p tcp -m tcp --dport 9898 -m conntrack --ctstate NEW -j ACCEPT
    # iptables -A IN_public_allow -p tcp -m tcp --dport 6443 -m conntrack --ctstate NEW -j ACCEPT
    # iptables -A IN_public_allow -p tcp -m tcp --dport 10250 -m conntrack --ctstate NEW -j ACCEPT
}

kube::node_up()
{
    curl http://$KIT_SERVER/install/progress/$ID/1
    kube::install_docker

    curl http://$KIT_SERVER/install/progress/$ID/2
    kube::load_images

    curl http://$KIT_SERVER/install/progress/$ID/3
    kube::install_bin

    curl http://$KIT_SERVER/install/progress/$ID/4
    kube::config_firewalld

    curl http://$KIT_SERVER/install/progress/$ID/5
    kubeadm join --skip-preflight-checks $@
    
    export KUBECONFIG=/etc/kubernetes/kubelet.conf
    echo "export KUBECONFIG=/etc/kubernetes/kubelet.conf" >> ~/.bashrc
}

main()
{
    HTTP_SERVER=$1
    KIT_SERVER=$2
    shift
    shift

    ID=$1
    shift

    kube::node_up $@
}

main $@
