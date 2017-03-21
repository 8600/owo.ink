import Component from 'ember-component';
import layout from '../templates/components/koenig-card';
import run from 'ember-runloop';

export default Component.extend({
    layout,
    init() {
        this._super(...arguments);
        this.set('isEditing', false);
    },
    didRender() {
        // add the classname to the wrapping card as generated by mobiledoc.
        // for some reason `this` on did render actually refers to the editor object and not the card object, after render it seems okay.
        run.schedule('afterRender', this,
            () => {
                let {env: {name}} = this.get('card');
                let mobiledocCard = this.$().parents('.__mobiledoc-card');

                mobiledocCard.removeClass('__mobiledoc-card');
                mobiledocCard.addClass('kg-card');
                mobiledocCard.addClass(name ? `kg-${name}` : '');
            }
        );
    },
    actions: {
        save() {
            this.set('doSave', Date.now());
        },

        toggleState() {
            this.set('isEditing', !this.get('isEditing'));
        }
    }
});
