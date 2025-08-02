import LightningDatatable from 'lightning/datatable';
import picklistTemplate from './picklistType.html';

export default class DatatablePicklist extends LightningDatatable {
    static customTypes = {
        picklist: {
            template: picklistTemplate,
            standardCellLayout: true,
            typeAttributes: ['options', 'value', 'placeholder', 'context']
        }
    };

    handleChange(event) {
        event.stopPropagation();

        const value = event.detail.value;
        const rowKey = event.target.dataset.context;
        const colKey = this._columnDefinition.fieldName;

        this.dispatchEvent(new CustomEvent('privateeditcustomcellchange', {
            bubbles: true, composed: true, cancelable: true,
            detail: {
                rowKeyValue: rowKey,
                draftValues: [{ _id: rowKey, [colKey]: value }]
            }
        }));
    }
}
