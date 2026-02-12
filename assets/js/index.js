const pattern = new Uint8Array([176, 173, 1, 0, 1, 255, 255, 255]);
const pattern2 = new Uint8Array([176, 173, 1, 0, 1]);

let quantifiableItems;
let file_read = null;
let lastList = [];
let lastQuantities = [];
let itemsData = {};
let selectedSlot;
let slots = [];
let idList = [];

let dlcFile = false;

window.onload = async () => {
    readJsonFiles();
    const fileSelector = document.getElementById("savefile");
    fileSelector.addEventListener("change", async (event) => {
        if (document.getElementById("savefile").value === null) {
            alert("No file selected");
            return;
        }
        await readFile();
        updateSlotDropdown(getNames(file_read));
        document.getElementById("slot_selector").onchange = e => {
            document.getElementById("calculate").style.display = "inline-block";
        };
    });
}

function readFile() {
    return new Promise((resolve, reject) => {
        const file = document.getElementById("savefile").files[0];
        const reader = new FileReader();
        reader.onload = e => {
            file_read = e.target.result;
            if (
                !bufferEqual(
                    file_read["slice"](0, 4),
                    new Int8Array([66, 78, 68, 52]))
            ) {
                e.target.result = null;
                document.getElementById("slot_select").style.display = "none";
                alert("Insert a valid file");
                reject();
                return;
            }
            resolve();
        };
        reader.onerror = e => {
            console.error("Error : " + e.type);
            reject();
        };
        reader.readAsArrayBuffer(file);
    });
}

function bufferEqual(buf1, buf2) {
    if (buf1.byteLength !== buf2.byteLength) return false;
    const dv1 = new Int8Array(buf1);
    const dv2 = new Int8Array(buf2);
    for (let i = 0; i !== buf1.byteLength; i++) {
        if (dv1[i] !== dv2[i]) return false;
    }
    return true;
}

function updateSlotDropdown(slotNameList) {
    const select = document.getElementById("slot_select");
    select.innerHTML = `<strong>Select slot: </strong>
        <select aria-label="Select slot" id="slot_selector">
        <option hidden selected>
            Select the slot whose inventory you want to analyze
        </option>`;
    const selector = select.getElementsByTagName("select")[0];
    for (let i = 0; i < 10; i++) {
        if (slotNameList[i] === "") {
            selector.innerHTML += `<option value="${i}" disabled> - </option>`;
        } else {
            selector.innerHTML += `<option value="${i}"> ${slotNameList[i]} </option>`;
        }
    }
    select.style.display = "block";
}

function getNames(file_read) {
    const decoder = new TextDecoder("utf-8");
    const _decode = (sliceStart, sliceStop, stopOffset = 32) => decoder.decode(
        new Int8Array(Array.from(new Uint16Array(file_read.slice(
            sliceStart,
            sliceStop + stopOffset
    )))));

    const slotBytes = [
        [0x1901d0e, 0x1901d0e],
        [0x1901f5a, 0x1901f5a],
        [0x19021a6, 0x19021a6],
        [0x19023f2, 0x19023f2],
        [0x190263e, 0x190263e],
        [0x190288a, 0x190288a],
        [0x1902ad6, 0x1902ad6],
        [0x1902d22, 0x1902d22],
        [0x1902f6e, 0x1902f6e],
        [0x19031ba, 0x19031ba]
    ];
    const names = [];
    slotBytes.forEach( ( slot ) => names.push(
        _decode(slot[0], slot[1]).replaceAll("\x00", "")
    ));
    return names;
}

function start() {
    document.getElementById("formSection").style.display = "none";
    selectedSlot = document.querySelector("#slot_selector option:checked").value;
    fetchInventory();
    calculate();
}

function sanitizeImgName(name) {
    if (name.includes("Bell Bearing")) {
        return "Bell Bearing";
    }
    if (name.includes("Note:")) {
        return "Note";
    }
    let newName = name.replaceAll(":", "").replaceAll("?", "");
    const index = newName.search(" \\[");
    if (index > 0) newName = newName.substring(0, index);
    return newName;
}

async function calculate() {

    // Fetch collectibles quantities
    const itemsQuantities = findItemQuantities(slots[selectedSlot]);
    lastQuantities = itemsQuantities;
    let globalCounter = 0;
    let globalTotal = 0;
    const itemsFound = itemsQuantities.reduce((prev, cur) => prev + cur, 0);
    const totalItems = quantifiableItems.reduce(
        (prev, cur) => prev + cur.places.length, 0
    );
    globalCounter += itemsFound;
    globalTotal += totalItems;

    //Create toggleNotFoundItems checkbox
    const notFoundCheckbox = `<div class="toggle-not-found">
      <input
        type="checkbox"
        id="notFound"
        onclick="toggleNotFoundItems(this.checked)"
      />
      <label for="notFound">Display not found items</label>
    </div>`;

    // Generate collectibles HTML block
    let regionsToInsert = `<dl>
      <dt class="regionTitle closed">
        Collectibles <span class="counter">
          (${itemsFound} / ${totalItems})
        </span>
      </dt>
      <dd class="closed">
      <div class="itemList">`;

    for (let i = 0; i < quantifiableItems.length; i++) {
        regionsToInsert += `<div class="itemCard">
          <img
            alt="${quantifiableItems[i].name}"
            src="assets/img/items/${quantifiableItems[i].name.replaceAll(":", "")}.png"
          />
          <p id="quantifiable${i}">${quantifiableItems[i].name}</p>
          <p>${itemsQuantities[i]} / ${quantifiableItems[i].places.length}</p>
          </div>`;
    }
    regionsToInsert += `</div></dd>`;

    // Generate regions blocks
    Object.keys(itemsData).forEach(region => {
        let zonesToInsert = "";
        let regionCounter = 0;
        let regionTotal = 0;
        Object.keys(itemsData[region]).forEach(zone => {
            let itemsToInsert = "";
            let counter = 0;
            Object.keys(itemsData[region][zone]).forEach(itemKey => {
                if (idList.includes(itemKey)) {
                    counter++;
                    itemsToInsert += `<div class="itemCard" id="${itemKey}">
                      <a
                        target="_blank"
                        href="https://eldenring.wiki.fextralife.com/${
                            sanitizeURL(itemsData[region][zone][itemKey].name)
                        }"
                      >
                        <img
                            alt="${itemsData[region][zone][itemKey].name}"
                            src="assets/img/items/${sanitizeImgName(
                                itemsData[region][zone][itemKey].name
                            )}.webp"
                        />
                        <p>${itemsData[region][zone][itemKey].name}</p>
                      </a>
                    </div>`;
                }
                else {
                    itemsToInsert += `<div class="itemCard disabledCard" id="${itemKey}">
                      <div class="tooltip">
                        Hint <div class="tooltipText">
                          ${itemsData[region][zone][itemKey].hint}
                      </div>
                    </div>
                    <img
                      alt="${itemsData[region][zone][itemKey].type}"
                      src="assets/img/hints/${itemsData[region][zone][itemKey].type}.png"
                    />
                    <p>??????????</p>
                    <input type="hidden" value="${
                        itemsData[region][zone][itemKey].name
                    }"/>
                    <input type="hidden" value="${
                        itemsData[region][zone][itemKey].type
                    }"/>
                    </div>`;
                }
            });
            // Quantifiable icons
            let icons = `<span class="iconList">`;
            quantifiableItems.forEach(item => {
                const n = item.places.reduce(
                    (cnt, val) => ( val === zone ? cnt + 1 : cnt ), 0
                );
                for (let i = 0; i < n; i++) {
                    icons += `<img
                      alt="${item.name}"
                      title="${item.name}"
                      src="assets/img/items/${item.name.replaceAll(":", "")}.png"
                    />`
                }
            });
            icons += `</span>`;

            const zoneTotal = Object.keys(itemsData[region][zone]).length;
            // Zone insertion
            regionCounter += counter;
            regionTotal += zoneTotal;

            if (zoneTotal != 0) {
                zonePctg = Math.floor((counter / zoneTotal) * 100);
            } else {
                zonePctg = 100;
            }

            zonesToInsert += `<dt class="zoneTitle closed">
              ${zone}${icons}<span class="counter">
                (${counter} / ${
                    Object.keys(itemsData[region][zone]).length
                }) ${zonePctg}%
              </span>
            </dt>
            <dd class="closed">
              <div class="itemList">${itemsToInsert}</div>
            </dd>`;
        });

        // Region insertion
        globalCounter += regionCounter;
        globalTotal += regionTotal;

        if (regionTotal != 0) {
            regionPctg = Math.floor((regionCounter / regionTotal) * 100);
        } else {
            regionPctg = 100;
        }

        regionsToInsert += `<dt class="regionTitle closed">
          ${region}<span class="counter">
            (${regionCounter} / ${regionTotal}) ${regionPctg}%
          </span>
        </dt>
        <dd class="closed">
          <dl>${zonesToInsert}</dl>
        </dd>`;
    });
    regionsToInsert += `</dl>`;

    // Global completion
    const completion = `<h2>Completion: ${
        Math.floor(globalCounter / globalTotal * 100)}%
    </h2>`;

    // Assemble final HTML page
    document.getElementById("resultSection").innerHTML = (
        completion
        + notFoundCheckbox
        + regionsToInsert
    );

    // Add collapsible feature
    const elts = document.getElementsByTagName("dt");
    for (let elt of elts) {
        elt.onclick = toggleDisplay;
    }
}

function fetchInventory() {
    const saves_array = new Uint8Array(file_read);
    slots = get_slot_ls(saves_array);
    const inventory = Array.from(getInventory(slots[selectedSlot]));
    idList = split(inventory, dlcFile ? 8 : 16);
    idList.forEach((raw_id, index) => (
        idList[index] = getIdReversed(raw_id).toUpperCase())
    );
    lastList = idList;
}

function toggleDisplay() {
    const elt = this.nextElementSibling;
    this.classList.toggle("closed");
    this.classList.toggle("opened");
    elt.classList.toggle("closed");
    elt.classList.toggle("opened");
}

async function readJsonFiles() {
    try {
        let res = await fetch("assets/json/data.json");
        const itemsData1 = await res.json();
        let res2 = await fetch("assets/json/dlcData.json");
        const itemsData2 = await res2.json();
        itemsData = { ...itemsData1, ...itemsData2 };
        res = await fetch("assets/json/collectibles.json");
        quantifiableItems = await res.json();
    }
    catch (e) {
        console.error(e);
    }
}

function get_slot_ls(dat) {
    const slot1 = dat.subarray(0x00000310, 0x0028030f + 1);
    const slot2 = dat.subarray(0x00280320, 0x050031f + 1);
    const slot3 = dat.subarray(0x500330, 0x78032f + 1);
    const slot4 = dat.subarray(0x780340, 0xa0033f + 1);
    const slot5 = dat.subarray(0xa00350, 0xc8034f + 1);
    const slot6 = dat.subarray(0xc80360, 0xf0035f + 1);
    const slot7 = dat.subarray(0xf00370, 0x118036f + 1);
    const slot8 = dat.subarray(0x1180380, 0x140037f + 1);
    const slot9 = dat.subarray(0x1400390, 0x168038f + 1);
    const slot10 = dat.subarray(0x16803a0, 0x190039f + 1);
    return [slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8, slot9, slot10];
}

function getInventory(slot) {
    index = subfinder(slot, pattern) + pattern.byteLength + 8;
    if (!index) {
        index = 0;
        do {
            index += subfinder(
                slot.subarray(index), pattern2
            ) + pattern2.byteLength + 3;
        } while (slot[index - 3] != 0 && index);
        dlcFile = true;
    }
    index1 = subfinder(
        slot.subarray(index, slot.byteLength),
        new Uint8Array(50).fill(0)
    ) + index + 6;
    console.log(slot.subarray(index, index1));
    return slot.subarray(index, index1);
}

function subfinder(mylist, pattern) {
    for (let i = 0; i < mylist.byteLength; i++) {
        if (
            mylist[i] === pattern[0]
            && bufferEqual(
                mylist.subarray(i, i + pattern.byteLength),
                pattern
            )
        ) return i;
    }
}

function split(list_a, chunk_size) {
    const splitted = [];
    for (let i = 0; i < list_a.length; i += chunk_size) {
        let chunk = list_a.slice(i, i + chunk_size);
        splitted.push(chunk);
    }
    return splitted;
}

function getIdReversed(id) {
    let final_id = "";
    tmp = id.slice(0, 4).reverse();
    for (let i = 0; i < 4; i++) {
        final_id += decimalToHex(tmp[i], 2);
    }
    return final_id;
}

function decimalToHex(d, padding) {
    let hex = Number(d).toString(16);
    padding = (
        typeof padding === "undefined" || padding === null
        ? (padding = 2)
        : padding
    );

    while (hex.length < padding) {
        hex = "0" + hex;
    }
    return hex;
}

function findItemQuantities(slot) {
    const result = new Array(quantifiableItems.length).fill(0);
    for (let i = 0; i < slot.byteLength - 4; i++) {
        for (let j = 0; j < quantifiableItems.length; j++) {
            const item = quantifiableItems[j];
            if (
                slot[i] === item.id[0]
                && slot[i + 1] === item.id[1]
                && slot[i + 2] === item.id[2]
                && slot[i + 3] === 176
            ) { result[j] = slot[i + 4];}
        }
    }
    return result;
}

function toggleNotFoundItems(value) {
    const elts = document.getElementsByClassName("disabledCard");
    for (let card of elts) {
        if (value) {
            const name = card.getElementsByTagName("input")[0].value;
            card.getElementsByTagName("img")[0].src = `assets/img/items/${
                sanitizeImgName(name)
            }.webp`;
            card.getElementsByTagName("p")[0].innerText = name;
        }
        else {
            const type = card.getElementsByTagName("input")[1].value;
            card.getElementsByTagName("img")[0].src = `assets/img/hints/${type}.png`;
            card.getElementsByTagName("p")[0].innerText = "??????????";
        }
    }
}

function sanitizeURL(name) {
    if (name === "Gauntlets")
        return "Chain+Gauntlets";
    return name
        .replaceAll(" +1", "")
        .replaceAll(" +2", "")
        .replaceAll(" (1)", "")
        .replaceAll(" (2)", "")
        .replaceAll("[", "(")
        .replaceAll("]", ")")
        .replaceAll(" ", "+");
}
