const envsFile = "environments.json";
const activeEnvFile = "active_env.json";

let environment;

let backendUrl, apiRoot, authUrl, fileApiUrl;


let p1 = new Promise((resolve,reject)=>
    $.get(envsFile)
        .done(function (data) {
            resolve(data);
        })
        .fail(function (data) {
            reject(["could not load envFile",data]);
        })
);
let p2 = new Promise((resolve,reject)=>
    $.get(activeEnvFile)
        .done(function (data) {
            resolve(data);
        })
        .fail(function (data) {
            reject(["could not load activeEnv",data]);
        })
);


Promise.all([p1,p2])
    .then((values)=>{
        console.log(values);
        let environments,active;
        [environments,active] = values;
        active = active.active;
        console.log(active);
        environment = environments[active];
        backendUrl = environments[active].backendUrl;
        apiRoot = environments[active].feDBapiUrl;
        // authUrl = environments[active].authUrl;
        // fileApiUrl = environments[active].fileApiUrl;

        $(".pageOverlay").remove();

    })
    .catch((a)=>{
        console.log(a);
        alert("Failed to load configuration");
    });



function messageModal(options)
{

    function renderButton(buttonData) {
        console.log(buttonData);
        let b = $("<button>").html(buttonData.label).addClass("btn").addClass(buttonData.class);
        if(buttonData.attrs) {
            Object.getOwnPropertyNames(buttonData.attrs).forEach(function (attrName) {
                b.attr(attrName, buttonData.attrs[attrName]);
            });
        }
        if(buttonData.callback) {
            b.on("click",buttonData.callback);
        }
        console.log("-------",b)
        return b;
    }


    modal = $("#messageModal").modal();

    let modalData = {
        title: null,
        body: "",
        buttons: [
            {
                label: "Inchide",
                attrs: {
                    "data-dismiss": "modal",
                },
                class: "btn btn-secondary"
            }
        ]
    };

    Object.assign(modalData,options);
    console.log("++++++",modalData);

    if(modalData.size) {
        switch(modalData.size){
            case "lg":
                modal.find(".modal-dialog").addClass("modal-lg");
                break;
            case "xl":
                modal.find(".modal-dialog").addClass("modal-xl");
                break;
        }
    }

    if(modalData.title===null) {
        modal.find(".modal-header").hide();
    }
    else {
        modal.find(".modal-title").html(modalData.title);
    }


    if(modalData.body===null) {
        modal.find(".modal-body").hide();
    }
    else {
        modal.find(".modal-body").html(modalData.body);
    }

    if(!modalData.buttons || modalData.buttons.constructor!==Array) {
        modal.find(".modal-footer").hide();
        return;
    }

    let footer = modal.find(".modal-footer").empty();

    modalData.buttons.forEach(function (button) {
        footer.append(renderButton(button));
    });
}

moment.updateLocale('ro', {
    weekdaysMin : ["D", "L", "Ma", "Mi", "J", "V", "S"],
    weekdaysShort : ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"],
    weekdays : ["Duminica", "Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata"],
    months:["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"],
    monthsShort: ["Ian","Feb","Mar","Apr","Mai","Iun","Iul","Aug","Sep","Oct","Noi","Dec"]
});
moment.locale("ro");

let wd = 10;
var userId = null;
var geoLocation = null;
var saveUserId;
var logoutUserId;

function toggleTab(src) {
    let $src = $(src);
    console.log($src)
    $($src.data("menu")).children(".menuitem").removeClass("active");
    $src.parents(".menuitem").addClass("active");
    let content = $($src.data("target"));
    content.parent().children().hide().each(function () {
        $($(this).data("connected")).hide();
    });
    $(content.show().data("connected")).show();
    if($src.data("target")=="#registru" || $src.data("target")=="#reports") {
        console.log("loadUserTTRegistryEntries")
        loadUserTTRegistryEntries();
    }
}

function logme(msg) {
    let $dbg = $("#dbg");
    $dbg.val($dbg.val() + "\n" + msg);
}

function stopWork() {
    $("#loader").show();
    let ttid = current_ttregistry.relationships.started_work[0].id;
    let inst = $("<span>").apiator({returninstance:true,resourcetype:"item"}).setUrl(apiUrl+"/timetracking/"+ttid)
    inst.id = ttid;
    inst.update({status:"f"})
        .then(function (data) {

            $("#loader").hide();
            $("#working").hide();
            $("#stopOk").show();
            $("#stopOk .durationh").text(Math.floor(data.attributes.duration/60));
            $("#stopOk .durationm").text(Math.floor(data.attributes.duration%60));
            setTimeout(function () {
                $("#stopOk").fadeOut();
                checkuser();
            },3000);
        })
}

function getLocation() {
    function processFailed2getCurrentPosition(err) {
        switch (err.code) {
            case 1: // PERMISSION_DENIED
                messageModal({
                    body: "Trebuie sa permiteti acces la pozitia dumnevoastra pentru a putea incepe pontajul.",
                    buttons: [
                        {
                            label: "Permite",class: "btn-success",attrs: {"data-dismiss":"modal"},
                            callback: function () {
                                requestPosition();
                            }
                        },
                        {
                            label: "Anuleaza",class: "btn-secondary",attrs: {"data-dismiss":"modal"}
                        },
                    ]
                });

                break;
            case 2: // POSITION_UNAVAILABLE
                delete geoLocation;
                break;

        }
    }

    function validatePosition(pos) {
        pos = pos.coords;
        logme(pos.latitude+" / " + pos.longitude + " / " +pos.accuracy );

        if(typeof watchID!=="undefined") {
            navigator.geolocation.clearWatch(watchID);
        }
        positionwd--;
        if(pos.accuracy>500) {
            if(positionwd>0) {
                watchID = navigator.geolocation.watchPosition(validatePosition);
                return;
            }
            else {
                messageModal({
                    body: "Pozitia este prea imprecisa ("+pos.accuracy+"). Incearca sa pozitionezi telefonul in exterior sau poti incepe pontajul, dar va fi eroarea va fi raportata.",
                    buttons: [
                        {
                            label: "Continua",class: "btn-danger",attrs: {"data-dismiss":"modal"},
                            callback: function () {
                                startWork(pos);
                            }
                        },
                        {
                            label: "Reincearca",class: "btn-success",attrs: {"data-dismiss":"modal"},
                            callback: function () {
                                requestPosition();
                            }
                        },
                        {
                            label: "Anuleaza",class: "btn-secondary",attrs: {"data-dismiss":"modal"}
                        },
                    ]
                });
            }
        }

        $("#pos").text($("#pos").text() + " ok");
        $("#loadPostion").hide();
        // if(getDistanceFromLatLonInKm(pos.latitude,pos.longitude)) {        }
    }

    function requestPosition() {
        navigator.geolocation.getCurrentPosition(validatePosition, processFailed2getCurrentPosition, {
            enableHighAccuracy: true,timeout: 5000,maximumAge: 0
        });
    }
    $("#pos").text("");


    requestPosition();
    // if(!navigator.permissions) {
    //     return;
    // }
    //
    //
    // // Permission API is implemented
    // navigator.permissions.query({name: 'geolocation'})
    //     .then(function (permission) {
    //         if (permission.state === "granted") {
    //             requestPosition();
    //             return;
    //         }
    //         komponentor.intent("/common/messagemodal").data({
    //             body: "<p>Pentru a putea incepe pontajul este necesar ca aplicatia sa acceseze locatia dumneavoastra.</p>" +
    //                 permission.state +
    //                 "<p>Va rugam sa permite aplicatiei sa obtina locatia dumnevoastra.</p>" +
    //                 "<p class='alert alert-default-success'><strong>Important</strong>: locatia dumnevoastra nu este raportata mai departe.</p>",
    //             buttons: [
    //                 {
    //                     label: "Permite", class: "btn-success",attrs: {"data-dismiss":"modal"},
    //                     callback: function () {
    //                         requestPosition();
    //                     }
    //                 },
    //                 {
    //                     label: "Anuleaza",class: "btn-secondary",attrs: {"data-dismiss":"modal"}
    //                 },
    //             ]
    //         }).send();
    //     });
}

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2-lat1);  // deg2rad below
    var dLon = deg2rad(lon2-lon1);
    var a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg) {
    return deg * (Math.PI/180);
}

function startWork() {
    console.log("Start work");
    if(navigator)
        $("#loader").show();

    let sel = $("#projectSelect form").find("option:selected").data().instance;
    let data = {
        employee: current_ttregistry.relationships.emplid.id,
    };
    if(sel.attributes.hourly_rate) {
        data.hourly_rate = sel.attributes.hourly_rate;
    }
    if(sel.attributes.op_id) {
        data.operation = sel.attributes.op_id;
    }
    if(sel.attributes.order_id) {
        data.order = sel.attributes.order_id;
    }
    if(sel.attributes.currency) {
        data.currency = sel.attributes.currency;
    }

    $("<span>")
        .apiator({returninstance: true,resourcetype: "collection"})
        .setUrl(apiUrl+"/timetracking")
        .append(data)
        .then(function () {
            $("#projectSelect").fadeOut();
            checkuser();
        })
        .catch(function (xhr) {
            let err = xhr.jqXHR.responseJSON.errors[0]
            console.log(err);
            let errMsg = $("#unknownErr").show();
            errMsg.children().text(err.title.split("\n")[0]);
            $("#loader").hide();
            setTimeout(()=>errMsg.hide(200),2000);
        });
}

function backToLogin() {
    logoutUserId();
    $('#loggedInNavBarBottom').hide();
    $('.overlay').hide();
    $('#login').show();
}

function loadUserTTRegistryEntries() {
    let usrTT = $("<span>")
        .apiator({type: "timetracking",resourcetype: "collection",returninstance:true})
        .setUrl(apiRoot+"/employees/"+localStorage.getItem("emplId")+"/timetracking?sort=-start");

    usrTT.loadFromRemote().then(function (data) {
        let ttGroups = [];
        let grpsHash = {};
        let cursor=null;
        data.items.forEach(function (item) {
            console.log("item-----------",item)

            let start = moment(item.attributes.start);
            let stop = item.attributes.stop ? moment(item.attributes.stop) : null;
            let todayText = start.format("ddd, D MMMM YYYY");
            if(!cursor || cursor!==todayText) {
                cursor = todayText;
                grpsHash[cursor] = [];
                ttGroups.push(cursor);
            }
            grpsHash[cursor].push({
                id: start,
                attributes:{
                    start: start,
                    stop: stop,
                    duration: item.attributes.stop ? moment.duration(stop.diff(start))  : null
                }
            });
        });

        for(let i=0;i<ttGroups.length;i++) {
            // grps[i] = grpsHash[grps[i]];
            ttGroups[i] = {
                id: ttGroups[i],
                attributes:{duration:moment.duration(0)},
                relationships:{
                    slots:{
                        data:grpsHash[ttGroups[i]]
                    }
                }
            };
            ttGroups[i].relationships.slots.data.forEach(function (item) {
                ttGroups[i].attributes.duration.add(item.attributes.duration);
            })

        }

        let inst = $("#ttregistry").apiator({returninstance:true});
        inst.loadFromData(ttGroups);

    });
}

function checkuser() {
    if(typeof userId==="undefined" || userId==="" || userId===null) {
        backToLogin();
        return;
    }

    console.log("userid.....",userId);

    $(".overlay").hide();
    $("#loader").show();

    $("<span>").apiator({returninstance: true,resourcetype: "item"})
        .setUrl(apiUrl+"/tags_v2/"+userId+"?include=started_work,emplid,alloc_orders")
        .loadFromRemote()
        .then(function (data) {
            console.log("User logged in")
            stopCodeScanner();
            localStorage.setItem("emplId",data.relationships.emplid.id)
            console.log(data);
            $(".overlay").hide();
            $("#pontaj").show();
            $('#loggedInNavBarBottom').show();

            loadUserTTRegistryEntries();

            saveUserId(userId);

            current_ttregistry = data;

            if(data.relationships.started_work.length) {
                let cont = $("#working").fadeIn();
                if(data.relationships.started_work[0].attributes.order_label) {
                    cont.find(".project").html(data.relationships.started_work[0].attributes.order_label);
                }
                if(data.relationships.started_work[0].attributes.operation_name) {
                    cont.find(".operation").html(data.relationships.started_work[0].attributes.operation_name);
                }

                showKontor = true;

                cont.find(".emplName").text(data.attributes.fname+" "+data.attributes.lname);

                function showTime() {
                    let dateDiffSeconds = Math.round(((new Date()).getTime()-(new Date(data.relationships.started_work[0].attributes.start)).getTime())/1000);
                    let seconds = dateDiffSeconds%60;
                    let minutes = Math.floor(dateDiffSeconds/60);
                    let hours = Math.floor(minutes/60);
                    minutes = minutes%60;

                    let elapsed = ("0" + hours).slice(-2) + ":"+("0" + minutes).slice(-2) + ":"+("0" + seconds).slice(-2);
                    cont.find(".elapsedTime").html(elapsed);

                    if(showKontor) {
                        setTimeout(showTime,1000);
                    }
                }
                showTime();
                return;
            }

            let projView = $("#projectSelect");
            projView.find("#userFullName").html(data.attributes.fname + " " + data.attributes.lname);
            let instance = projView.fadeIn().find("select").apiator({returninstance: true,resourcetype: "collection"});

            let projects = [
                {
                    id: null,
                    attributes:{
                        op_id: null,
                        op_name: null,
                        order_id: null,
                        order_name: null,
                        hourly_rate: null,
                        currency: null
                    }
                },
                ...data.relationships.alloc_orders
            ];

            instance.loadFromData(projects);
            if(projects.length<2) {
                $("#projectSelect").find("select").hide();
            }
        })
        .catch(function (xhr) {
            console.log(xhr)
            logoutUserId();
            backToLogin();
            console.log("XHRS",xhr);
            let cb,alert;
            switch(xhr.jqXHR.status) {
                case 404:
                    alert = $("#invalidCode").show();
                    cb = ()=>alert.fadeOut();
                    break;
                case 500:
                    alert = $("#severError").show();
                    cb = ()=>alert.fadeOut();
                    break;
                case 0:
                    alert = $("#serviceUnavail").show().text(JSON.stringify(xhr.jqXHR));
                    cb = ()=>alert.fadeOut();
                    break;
                default:
                    alert = $("#unknowError").show();
                    cb = ()=>alert.fadeOut();
            }
            setTimeout(cb,2000);
        });
}


function logoutAsApp() {
    console.log("logout")
    userId = null;
    localStorage.removeItem("userId");
}

function logoutAsExtension() {

}

function saveUserIdAsExtension(userId) {
    parent.postMessage({command:"set",data:{userId:userId}},"*");
}

function saveUserIdAsApp(userId) {
    localStorage.setItem("userId",userId);
}

window.addEventListener('message', function(event) {
    if(typeof event.data.command==="undefined") {
        return;
    }

    switch (event.data.command) {
        case "sync":
            console.log(event.data);
            userId = event.data.data.userId ?? null;
            geoLocation = event.data.data.geoLocation ?? null;
            checkuser();
            break;
        case "reload":
            window.location.reload();
            break;
    }
});


function init() {
    // navigator.permissions.query({name:'geolocation'}).then((permission)=>{$("#pos").text(permission.state);
    //     console.log("perm",permission)})
    wd--;
    if(wd<=0) {
        alert("eroare in incarca setarile.");
        return;
    }

    if(typeof apiRoot==="undefined") {
        setTimeout(init,1000);
        return;
    }

    apiUrl = apiRoot;


    if(parent===window) {
        console.log("parent is window");
        saveUserId = saveUserIdAsApp;
        logoutUserId = logoutAsApp;
        userId = localStorage.getItem("userId");
        checkuser();
        // getLocation();
        return;
    }
    else {
        $("#loader").show();
        parent.postMessage({command:"get",data:{userId:null,geoLocation:null}},"*");
        saveUserId = saveUserIdAsExtension;
        logoutUserId = logoutAsExtension;
    }
}

init();

$(function() {

    var start = moment().subtract(29, 'days');
    var end = moment();

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
    }

    $('#reportrange').daterangepicker({
        startDate: start,
        endDate: end,
        ranges: {
            'Today': [moment(), moment()],
            'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
            'Last 7 Days': [moment().subtract(6, 'days'), moment()],
            'Last 30 Days': [moment().subtract(29, 'days'), moment()],
            'This Month': [moment().startOf('month'), moment().endOf('month')],
            'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
        }
    }, cb);

    cb(start, end);

});


const html5QrCode = new Html5Qrcode("reader");
const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    userId=decodedText;
    checkuser()
};
const config = { fps: 10, qrbox: { width: 600 , height: 600 } };

function startCodeScanner() {
    // If you want to prefer back camera
    html5QrCode.start({ facingMode: "environment" }, config, qrCodeSuccessCallback);
}
function stopCodeScanner() {
    html5QrCode.stop();
}
startCodeScanner();

