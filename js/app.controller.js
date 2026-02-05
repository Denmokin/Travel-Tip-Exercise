import { utilService } from './services/util.service.js'
import { locService } from './services/loc.service.js'
import { mapService } from './services/map.service.js'

window.onload = onInit

// To make things easier in this project structure 
// functions that are called from DOM are defined on a global app object
window.app = {
    onRemoveLoc,
    onUpdateLoc,
    onSelectLoc,
    onPanToUserPos,
    onSearchAddress,
    onCopyLoc,
    onShareLoc,
    onSetSortBy,
    onSetFilterBy,
    onUpdateModal,
    onCloseModal,
    onAddModal,
    onAddLoc,
}

var gUserPos = null


function onInit() {
    getFilterByFromQueryParams()
    loadAndRenderLocs()
    mapService.initMap()
        .then(() => {
            // onPanToTokyo()
            mapService.addClickListener(onAddModal)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot init map')
        })

    // close modal 
    const closeBtn = document.querySelector('.modal__close-btn')
    const modal = document.querySelector('.modal')
    closeBtn.addEventListener('click', () => {
        modal.close()
    })
}

function renderLocs(locs) {
    const selectedLocId = getLocIdFromQueryParams()

    var strHTML = locs.map(loc => {
        const className = (loc.id === selectedLocId) ? 'active' : ''

        const distanceStr = gUserPos
            ? `Distance: ${utilService.getDistance(
                gUserPos,
                { lat: loc.geo.lat, lng: loc.geo.lng },
                'K'
            )} km`
            : 'Distance: —'

        return `
        <li class="loc ${className}" data-id="${loc.id}">
            <h4>  
            <span>${loc.name}</span>
                <span>${distanceStr}</span>
                <span title="${loc.rate} stars">${'★'.repeat(loc.rate)}</span>
            </h4>
            <p class="muted">
                Created: ${utilService.elapsedTime(loc.createdAt)}
                ${(loc.createdAt !== loc.updatedAt) ?
                ` | Updated: ${utilService.elapsedTime(loc.updatedAt)}`
                : ''}
                </p>
            <div class="loc-btns">     
            <button title="Delete" onclick="app.onRemoveLoc('${loc.id}')">🗑️</button>
               <button title="Edit" onclick="app.onUpdateModal('${loc.id}')">✏️</button>
               <button title="Select" onclick="app.onSelectLoc('${loc.id}')">🗺️</button>
            </div>     
        </li>`}).join('')

    const elLocList = document.querySelector('.loc-list')
    elLocList.innerHTML = strHTML || 'No locs to show'

    renderLocStats()

    if (selectedLocId) {
        const selectedLoc = locs.find(loc => loc.id === selectedLocId)
        displayLoc(selectedLoc)
    }
    document.querySelector('.debug').innerText = JSON.stringify(locs, null, 2)
}


function onRemoveLoc(locId) {
    if (!confirm('Are you sure you want to remove this location?')) return

    locService.remove(locId)
        .then(() => {
            flashMsg('Location removed')
            unDisplayLoc()
            loadAndRenderLocs()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot remove location')
        })
}

function onSearchAddress(ev) {
    ev.preventDefault()
    const el = document.querySelector('[name=address]')
    mapService.lookupAddressGeo(el.value)
        .then(geo => {
            mapService.panTo(geo)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot lookup address')
        })
}

function onAddLoc(ev, geo) {
    console.log('geo: ', geo)
    console.log('gg')
    ev.preventDefault()

    const form = ev.currentTarget
    const formData = new FormData(form)
    const name = formData.get('place-name')
    const rate = formData.get('rate')

    const locName = name
    if (!locName) return

    const loc = {
        name: locName,
        rate: rate,
        geo
    }

    locService.save(loc)
        .then((savedLoc) => {
            flashMsg(`Added Location (id: ${savedLoc.id})`)
            utilService.updateQueryParams({ locId: savedLoc.id })
            loadAndRenderLocs()
            onCloseModal()
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot add location')
        })
}



function loadAndRenderLocs() {
    locService.query()
        .then(renderLocs)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot load locations')
        })
}

function onPanToUserPos() {

    mapService.getUserPosition()
        .then(latLng => {
            mapService.panTo({ ...latLng, zoom: 15 })
            gUserPos = latLng
            unDisplayLoc()
            loadAndRenderLocs()
            flashMsg(`You are at Latitude: ${latLng.lat} Longitude: ${latLng.lng}`)
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot get your position')
        })
}



function onUpdateLoc(ev, locId) {

    ev.preventDefault()

    const form = ev.currentTarget
    const formData = new FormData(form)
    const rate = formData.get('rate')

    locService.getById(locId)
        .then(loc => {
            if (rate && rate !== loc.rate) {
                loc.rate = rate
                return locService.save(loc)
            }
        })
        .then(savedLoc => {
            if (savedLoc) {
                flashMsg(`Rate was set to: ${savedLoc.rate}`)
                loadAndRenderLocs()
                onCloseModal()
            }
        })
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot update location')
        })
}


function onUpdateModal(locId) {

    const elModalDiv = document.querySelector('.modal > div')
    const elModal = document.querySelector('.modal')
    const strFORM = `<form onsubmit="app.onUpdateLoc(event,'${locId}')" method="dialog" class="rate-form">
                    <h4 class="rate-form__title">Title</h4>
                    <label for="rate">Rating</label>
                    <input type="text" name="rate" id="rate"></input>
                    <button class="rate-form__button">Save</button>
                     </form>`
    elModalDiv.innerHTML = strFORM

    const elModalTitle = document.querySelector('.rate-form__title')
    const elModalInput = document.getElementById('rate')

    locService.getById(locId)
        .then(loc => {
            elModalInput.value = loc.rate
            elModalInput.placeholder = loc.rate
            elModalTitle.innerText = loc.name
            elModal.showModal()
        })
}



function onAddModal(geo) {
    console.log('geo: ', geo)

    const elModalDiv = document.querySelector('.modal > div')
    const elModal = document.querySelector('.modal')
    const strFORM = `<form method="dialog" class="add-form">
                    <h4 class="add-form__title">Add Location</h4>
                    <label for="place-name">Place Name</label>
                    <input placeholder="Enter Place Name" type="text" name="place-name" id="place-name" required></input>
                    <label for="rate">Rating</label>
                    <input placeholder="Add Rating" type="text" name="rate" id="rate" required></input>
                    <button class="add-form__button">Save</button>
                     </form>`
    elModalDiv.innerHTML = strFORM
    const elModalForm = document.querySelector('.add-form')
    elModalForm.onsubmit = (event) => app.onAddLoc(event, geo)
    elModal.showModal()
}


function onCloseModal() {
    const dialog = document.querySelector('.modal')
    dialog.close()
}



function onSelectLoc(locId) {
    return locService.getById(locId)
        .then(displayLoc)
        .catch(err => {
            console.error('OOPs:', err)
            flashMsg('Cannot display this location')
        })
}

function displayLoc(loc) {
    document.querySelector('.loc.active')?.classList?.remove('active')
    document.querySelector(`.loc[data-id="${loc.id}"]`).classList.add('active')

    mapService.panTo(loc.geo)
    mapService.setMarker(loc)

    const distanceStr = gUserPos
        ? `Distance: ${utilService.getDistance(
            gUserPos,
            { lat: loc.geo.lat, lng: loc.geo.lng },
            'K'
        )} km`
        : 'Distance: —'

    const el = document.querySelector('.selected-loc')
    el.querySelector('.loc-name').innerText = loc.name
    el.querySelector('.loc-address').innerText = loc.geo.address
    el.querySelector('.loc-distance').innerText = distanceStr
    el.querySelector('.loc-rate').innerHTML = '★'.repeat(loc.rate)
    el.querySelector('[name=loc-copier]').value = window.location
    el.classList.add('show')

    utilService.updateQueryParams({ locId: loc.id })
}

function unDisplayLoc() {
    utilService.updateQueryParams({ locId: '' })
    document.querySelector('.selected-loc').classList.remove('show')
    mapService.setMarker(null)
}

function onCopyLoc() {
    const elCopy = document.querySelector('[name=loc-copier]')
    elCopy.select()
    elCopy.setSelectionRange(0, 99999) // For mobile devices
    navigator.clipboard.writeText(elCopy.value)
    flashMsg('Link copied, ready to paste')
}

function onShareLoc() {
    const url = document.querySelector('[name=loc-copier]').value

    // title and text not respected by any app (e.g. whatsapp)
    const data = {
        title: 'Cool location',
        text: 'Check out this location',
        url
    }
    navigator.share(data)
}

function flashMsg(msg) {
    const el = document.querySelector('.user-msg')
    el.innerText = msg
    el.classList.add('open')
    setTimeout(() => {
        el.classList.remove('open')
    }, 3000)
}

function getFilterByFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const txt = queryParams.get('txt') || ''
    const minRate = queryParams.get('minRate') || 0
    locService.setFilterBy({ txt, minRate })

    document.querySelector('input[name="filter-by-txt"]').value = txt
    document.querySelector('input[name="filter-by-rate"]').value = minRate
}

function getLocIdFromQueryParams() {
    const queryParams = new URLSearchParams(window.location.search)
    const locId = queryParams.get('locId')
    return locId
}

function onSetSortBy() {
    const prop = document.querySelector('.sort-by').value
    const isDesc = document.querySelector('.sort-desc').checked

    if (!prop) return

    const sortBy = {}
    sortBy[prop] = (isDesc) ? -1 : 1

    // Shorter Syntax:
    // const sortBy = {
    //     [prop] : (isDesc)? -1 : 1
    // }

    locService.setSortBy(sortBy)
    loadAndRenderLocs()
}

function onSetFilterBy({ txt, minRate }) {
    const filterBy = locService.setFilterBy({ txt, minRate: +minRate })
    utilService.updateQueryParams(filterBy)
    loadAndRenderLocs()
}

function renderLocStats() {
    locService.getLocCountByRateMap().then(stats => {
        handleStats(stats, 'loc-stats-rate')
    })

    locService.getLocCountByUpdateMap().then(stats => {
        handleStats(stats, 'loc-stats-updated')
    })
}

function handleStats(stats, selector) {
    // stats = { low: 37, medium: 11, high: 100, total: 148 }
    // stats = { low: 5, medium: 5, high: 5, baba: 55, mama: 30, total: 100 }
    const labels = cleanStats(stats)
    const colors = utilService.getColors()

    var sumPercent = 0
    var colorsStr = `${colors[0]} ${0}%, `
    labels.forEach((label, idx) => {
        if (idx === labels.length - 1) return
        const count = stats[label]
        const percent = Math.round((count / stats.total) * 100, 2)
        sumPercent += percent
        colorsStr += `${colors[idx]} ${sumPercent}%, `
        if (idx < labels.length - 1) {
            colorsStr += `${colors[idx + 1]} ${sumPercent}%, `
        }
    })

    colorsStr += `${colors[labels.length - 1]} ${100}%`
    // Example:
    // colorsStr = `purple 0%, purple 33%, blue 33%, blue 67%, red 67%, red 100%`

    const elPie = document.querySelector(`.${selector} .pie`)
    const style = `background-image: conic-gradient(${colorsStr})`
    elPie.style = style

    const ledendHTML = labels.map((label, idx) => {
        return `
                <li>
                    <span class="pie-label" style="background-color:${colors[idx]}"></span>
                    ${label} (${stats[label]})
                </li>
            `
    }).join('')

    const elLegend = document.querySelector(`.${selector} .legend`)
    elLegend.innerHTML = ledendHTML
}

function cleanStats(stats) {
    const cleanedStats = Object.keys(stats).reduce((acc, label) => {
        if (label !== 'total' && stats[label]) {
            acc.push(label)
        }
        return acc
    }, [])
    return cleanedStats
}
