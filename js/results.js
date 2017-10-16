import Slick from 'slickgrid';


function load_results(endpoint) {
    fetch(endpoint).then((response) => {
        console.log(response);
    });
}
window.init_results = load_results;