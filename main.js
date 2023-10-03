// if ('serviceWorker' in navigator) {
// navigator.serviceWorker.register("assets/js/serviceworker.js");
// }

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
var logout;

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
                logout();
            },1500);
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

function confirmStartWork(button) {

    let instance = $(button).data().instance;
    let modal = $("#startWorkConfirm").modal("show");
    modal.find("[name=proiectId]").text(instance.attributes.order_name+" / " + instance.attributes.op_name);
    modal.find("[name=confirmButton]").on("click",()=>{modal.modal("hide");startWork(button);});
}

function startWork(button) {
    console.log("Start work");
    if(navigator)
        $("#loader").show();

    let sel = $(button).data().instance;
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
            $("#loader").hide();
            $("#projectSelect").fadeOut();
            logout();
        })
        .catch(function (xhr) {
            let err = xhr.jqXHR.responseJSON.errors[0]
            console.log(err);
            let errMsg = $("#unknownErr").show();
            errMsg.children().text(err.title.split("\n")[0]);
            $("#loader").hide();
            setTimeout(()=>errMsg.hide(200),1500);
        });
}

function backToLogin() {
    if($("#toggleKeyboadChkbox")[0].checked) {
        $("#toggleKeyboadChkbox")[0].checked = !$("#toggleKeyboadChkbox")[0].checked;
        toggleKeyboard($("#toggleKeyboadChkbox"));
    }
    $("#lookupform")[0].uid.value = "";

    $('#loggedInNavBarBottom').hide();
    $('.overlay').hide();
    $('#login').show();
    $('#pontaj').hide();
    startCodeScanner();
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

function checkuser(userId) {

    console.log("userid.....",userId);

    stopCodeScanner();
    $(".overlay").hide();
    $("#login").hide();
    $("#loader").show();

    $("<span>").apiator({returninstance: true,resourcetype: "item"})
        .setUrl(apiUrl+"/tags_v2/"+userId+"?include=started_work,emplid,alloc_orders")
        .loadFromRemote()
        .then(function (data) {
            localStorage.setItem("emplId",data.relationships.emplid.id)
            $(".overlay").hide();
            $("#loader").hide();
            $("#pontaj").show();

            // loadUserTTRegistryEntries();

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

                    let elapsed = hours.toString().padStart(2,"0") + ":"+minutes.toString().padStart(2,"0") + ":"+seconds.toString().padStart(2,"0");
                    cont.find(".elapsedTime").html(elapsed);

                    if(showKontor) {
                        setTimeout(showTime,1000);
                    }
                }
                showTime();
                return;
            }

            let projView = $("#projectSelect");
            $("#userFullName").html(data.attributes.fname + " " + data.attributes.lname);
            let instance = projView.fadeIn().find(".projects").apiator({returninstance: true,resourcetype: "collection"});

            let projects = data.relationships.alloc_orders;

            instance.loadFromData(projects)
            window.setTimeout(logout,5000);
            if(projects.length<2) {
                $("#projectSelect").find("select").hide();
            }
        })
        .catch(function (xhr) {
            console.log(xhr)
            logout();
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
            setTimeout(cb,1500);
        });
}


function logoutAsApp() {
    backToLogin();
    console.log("logout")
    userId = null;
    localStorage.removeItem("userId");
}

function logoutAsExtension() {
    backToLogin();
}

function saveUserIdAsExtension(userId) {
    parent.postMessage({command:"set",data:{userId:userId}},"*");
}

function saveUserIdAsApp(userId) {
    localStorage.setItem("userId",userId);
}

// window.addEventListener('message', function(event) {
//     if(typeof event.data.command==="undefined") {
//         return;
//     }

//     switch (event.data.command) {
//         case "sync":
//             console.log(event.data);
//             userId = event.data.data.userId ?? null;
//             geoLocation = event.data.data.geoLocation ?? null;
//             checkuser();
//             break;
//         case "reload":
//             window.location.reload();
//             break;
//     }
// });


function init() {
    // navigator.permissions.query({name:'geolocation'}).then((permission)=>{$("#pos").text(permission.state);
    //     console.log("perm",permission)})
    console.log("inint")
    wd--;
    if(wd<=0) {
        alert("eroare in incarca setarile.");
        return;
    }
    console.log("inint",wd)

    if(typeof apiRoot==="undefined") {
        setTimeout(init,1000);
        return;
    }

    apiUrl = apiRoot;

    console.log("inint",wd,apiUrl)

    saveUserId = saveUserIdAsApp;
    logout = logoutAsApp;
   
}

init();

$(function() {

    var start = moment().subtract(29, 'days');
    var end = moment();

    function cb(start, end) {
        $('#reportrange span').html(start.format('MMMM D, YYYY') + ' - ' + end.format('MMMM D, YYYY'));
    }

    // $('#reportrange').daterangepicker({
    //     startDate: start,
    //     endDate: end,
    //     ranges: {
    //         'Today': [moment(), moment()],
    //         'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
    //         'Last 7 Days': [moment().subtract(6, 'days'), moment()],
    //         'Last 30 Days': [moment().subtract(29, 'days'), moment()],
    //         'This Month': [moment().startOf('month'), moment().endOf('month')],
    //         'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
    //     }
    // }, cb);

    cb(start, end);

});


const html5QrCode = new Html5Qrcode("reader");
const qrCodeSuccessCallback = (decodedText, decodedResult) => {
    userId=decodedText;
    console.log(userId);
    checkuser(userId);
};
const config = { fps: 10, qrbox: { width: 300 , height: 300 } };

function startCodeScanner() {
    // If you want to prefer back camera
    html5QrCode.start({facingMode: "environment"}, config, qrCodeSuccessCallback)
        .then((a)=>console.log(a,"Scanner started"))
        .catch((e)=>{console.log("Cannot start scanner",e)
        })


}
function stopCodeScanner() {
    try {
        if(html5QrCode.isScanning) {
            html5QrCode.stop();
        }
    }
    catch (e) {
        console.log("Cannot stop scanner",e)
    }
}
startCodeScanner();



function invertColor(hex) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    // invert color components
    var r = (255 - parseInt(hex.slice(0, 2), 16)).toString(16),
        g = (255 - parseInt(hex.slice(2, 4), 16)).toString(16),
        b = (255 - parseInt(hex.slice(4, 6), 16)).toString(16);
    // pad each with zeros and return
    return padZero(r) + padZero(g) + padZero(b);
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

$("#keyboard").find("button").on("click",function(event){
    let val = $(event.target).text();
    let input = $("#lookupform")[0].uid;
    switch(val) {
        case "DEL":
            input.value = input.value.substring(0,input.value.length-1)
            break;
        case "CLR":
            input.value = ""
            break;
        default:
            input.value += val
    }
})

var mobileCheck = function() {
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
    return check;
};

if(mobileCheck()) {
    $("#lookupform")[0].uid.disabled = true;
}

function toggleKeyboard(chkbox) {
    console.log("tottle");
    if(chkbox.checked) {
        $('#keyboard').show();
        window.scrollTo(0, document.body.scrollHeight+500);
    }
    else {
        $('#keyboard').hide()
    }
}


window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent the mini-infobar from appearing on mobile.
    event.preventDefault();
    console.log('👍', 'beforeinstallprompt', event);
    // Stash the event so it can be triggered later.
    window.deferredPrompt = event;
    // Remove the 'hidden' class from the install button container.
    //divInstall.classList.toggle('hidden', false);
});


// butInstall.addEventListener('click', async () => {
//     console.log('👍', 'butInstall-clicked');
//     const promptEvent = window.deferredPrompt;
//     if (!promptEvent) {
//         // The deferred prompt isn't available.
//         return;
//     }
//     // Show the install prompt.
//     promptEvent.prompt();
//     // Log the result
//     const result = await promptEvent.userChoice;
//     console.log('👍', 'userChoice', result);
//     // Reset the deferred prompt variable, since
//     // prompt() can only be called once.
//     window.deferredPrompt = null;
//     // Hide the install button.
//     divInstall.classList.toggle('hidden', true);
// });